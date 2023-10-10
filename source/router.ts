/* eslint-disable no-console */
import express from 'express';
import { createClient } from 'redis';
import { ethers } from 'ethers';
import { randomBytes } from 'node:crypto';
import { listener } from './listener';

import type { Request, Response, NextFunction } from 'express';
import type { RedisClientType } from 'redis';

class HttpException extends Error {
  public status: number;
  public message: string;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.message = message;
  }
}

export const router = (operatorConfig: {
  redisUrl: string;
  jsonRpcUrl: string;
  privateKey: string;
  vrfAddress: string;
  expiration: number;
  confirmations: number;
}) => {
  if (!operatorConfig.redisUrl) throw new Error('You must set a valid redis server URL.');
  if (!operatorConfig.jsonRpcUrl) throw new Error('You must set a valid JSON-RPC provider URL.');
  if (!operatorConfig.privateKey) throw new Error('You must set a valid private key.');
  if (!operatorConfig.vrfAddress) throw new Error('You must set a valid contract address.');
  if (!operatorConfig.expiration) throw new Error('You must set a valid expiration time (in seconds).');
  if (!operatorConfig.confirmations)
    throw new Error('You must set a valid confirmations number (expressed in blocks).');

  const router: express.Router = express.Router();

  router.use(express.json());
  router.use(express.urlencoded({ extended: true }));

  const redisClient: RedisClientType = createClient({
    url: operatorConfig.redisUrl
  });

  redisClient.on('error', (err: unknown) => console.log('Redis Client Error', err));

  (async () => {
    await redisClient.connect();
  })();

  const provider: ethers.JsonRpcProvider = new ethers.JsonRpcProvider(operatorConfig.jsonRpcUrl);
  const signer: ethers.Wallet = new ethers.Wallet(operatorConfig.privateKey, provider);

  listener(redisClient, provider, signer, operatorConfig.vrfAddress, operatorConfig.confirmations);

  router.get('/commit', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.query.address || !ethers.isAddress(req.query.address))
        throw new HttpException(400, 'The `address` parameter is invalid.');
      if (!req.query.hash || !ethers.isHexString(req.query.hash, 32))
        throw new HttpException(400, 'The `hash` parameter is invalid.');

      // guestAddress: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
      // guestSeedHash: 0x3b089ef57030e354bd75ad91f4d68ee9d1f09a130597f5ad7ed88fd2db3dda5a
      const operatorSeed: Buffer = randomBytes(32);
      const operatorSeedHash: string = ethers.keccak256(operatorSeed);

      const expiration: number = Math.floor(Date.now() / 1000) + operatorConfig.expiration;

      const operatorData: string = ethers.solidityPacked(
        ['bytes32', 'bytes32', 'address', 'uint256'],
        [req.query.hash, operatorSeedHash, req.query.address, expiration]
      );
      const operatorDataHash: string = ethers.keccak256(operatorData);

      const operatorSignature: string = await signer.signMessage(ethers.getBytes(operatorDataHash));

      // Save the operator seed for this commit
      await redisClient.set(operatorDataHash, '0x' + operatorSeed.toString('hex'), { EX: operatorConfig.expiration });

      res.json({
        commit_id: operatorDataHash,
        seed_hash: operatorSeedHash,
        signature: operatorSignature,
        expiration: expiration
      });
    } catch (e: unknown) {
      return next(e);
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  router.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (error) {
      if (process.env.NODE_ENV !== 'test') console.error(error);

      if (error instanceof HttpException) {
        res.status(error.status).json({ error: error.message });
      } else if (error instanceof Error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Unknown error.' });
      }
    }
  });

  return router;
};

export default router;
