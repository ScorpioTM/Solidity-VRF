/* eslint-disable no-console */
import { ethers } from 'ethers';
import { revealCommit } from './helpers/revealCommit';
import CommitRevealVRFABI from './abis/CommitRevealVRF.json';

import type { ContractEventPayload } from 'ethers';
import type { RedisClientType } from 'redis';

interface PendingCommit {
  operatorSeed: string;
  confirmationBlock: number;
}

export function listener(
  redisClient: RedisClientType,
  provider: ethers.JsonRpcProvider,
  signer: ethers.Wallet,
  address: string,
  confirmations: number
) {
  if (!address || !ethers.isAddress(address)) throw new Error('You must specify a valid contract address.');
  if (!confirmations)
    throw new Error('You must specify the number of confirmations required to approve a commit (Minimum 1 block).');

  // Define the VRF contract
  const contract: ethers.Contract = new ethers.Contract(address, CommitRevealVRFABI, signer);

  // Represents a list of pending commits
  const pendingCommits: Record<string, PendingCommit> = {};

  // Holds the number of the last block
  let blockNumber: number = 0;

  // Listen for new blocks
  provider.on('block', async (newBlock: number) => {
    blockNumber = newBlock;

    // Loop through the pending commits
    for (const commitId in pendingCommits) {
      const pendingCommit: PendingCommit = pendingCommits[commitId];

      // Check if this commit is ready to be revealed
      if (pendingCommit.confirmationBlock <= blockNumber) {
        try {
          // Delete this commit from the pending list
          delete pendingCommits[commitId];

          // Reveal this commit
          await revealCommit(contract, commitId, pendingCommit.operatorSeed);
        } catch (e: unknown) {
          if (process.env.NODE_ENV !== 'test') console.error('Commit Reveal Error:', e);
        }
      }
    }
  });

  // Listen for new commits
  contract.on(
    'SeedCommitted',
    async (
      commitId: string,
      userSeed: string,
      operatorSeedHash: string,
      commitOwner: string,
      event: ContractEventPayload
    ) => {
      try {
        // Get the operator seed for this commit
        const operatorSeed: string | null = await redisClient.get(commitId);
        if (!operatorSeed) throw new Error('This commit has expired or does not exist.');

        // Check if this commit is ready to be revealed
        if (blockNumber >= event.log.blockNumber + (confirmations - 1)) {
          // Reveal this commit
          await revealCommit(contract, commitId, operatorSeed);
        } else {
          // Add this commit to the pending list
          pendingCommits[commitId] = {
            operatorSeed: operatorSeed,
            confirmationBlock: event.log.blockNumber + (confirmations - 1)
          };
        }
      } catch (e: unknown) {
        if (process.env.NODE_ENV !== 'test') console.error('Commit Reveal Error:', e);
      }
    }
  );
}

export default listener;
