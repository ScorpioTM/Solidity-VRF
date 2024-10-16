/* eslint-disable no-console */
import { ethers } from 'ethers';
import { EventFetcher } from './event-fetcher';
import { revealCommit } from './helpers/revealCommit';
import CommitRevealVRFABI from './abis/CommitRevealVRF.json';

import type { EventLog } from 'ethers';
import type { RedisClientType } from 'redis';

/**
 * Represents a pending commitment.
 */
interface PendingCommit {
  /**
   * The operator's seed for the commitment.
   */
  operatorSeed: string;

  /**
   * The confirmation block number.
   */
  confirmationBlock: number;
}

/**
 * Sets up an event listener to automatically reveal new commits in a Solidity smart contract.
 *
 * @param redisClient The Redis client to retrieve operator seeds.
 * @param provider The Ethereum provider to listen for events.
 * @param signer The wallet or signer for transaction signing.
 * @param address The address of the target contract.
 * @param confirmations The number of confirmations required to reveal a commit (minimum 1 block).
 */
export function listener(
  redisClient: RedisClientType,
  provider: ethers.JsonRpcProvider | ethers.WebSocketProvider,
  signer: ethers.Wallet | ethers.Signer,
  address: string,
  confirmations: number
): EventFetcher {
  if (!address || !ethers.isAddress(address)) throw new Error('You must specify a valid contract address.');
  if (!confirmations)
    throw new Error('You must specify the number of confirmations required to approve a commit (Minimum 1 block).');

  // Define the VRF contract
  const contract: ethers.Contract = new ethers.Contract(address, CommitRevealVRFABI, signer);

  // Represents a list of pending commits
  const pendingCommits: Record<string, PendingCommit> = {};

  // Holds the number of the last block
  let blockNumber: number = 0;

  const fetcher = new EventFetcher('SeedCommitted');

  fetcher.on('error', (message, error) => {
    console.error(message, error);
  });

  // Listen for new blocks
  fetcher.on('block', async (newBlock: number) => {
    blockNumber = newBlock;

    // Loop through the pending commits
    for (const commitId in pendingCommits) {
      const pendingCommit: PendingCommit = pendingCommits[commitId];

      // Check if this commit is ready to be revealed
      if (pendingCommit.confirmationBlock <= blockNumber) {
        try {
          // Reveal this commit
          await revealCommit(contract, commitId, pendingCommit.operatorSeed, { nonce: await provider.getTransactionCount(await signer.getAddress()) });

          // Delete this commit from the pending list
          delete pendingCommits[commitId];
        } catch (e: unknown) {
          if (process.env.NODE_ENV !== 'test') console.error('Commit Reveal Error:', e);
        }
      }
    }
  });

  // Listen for new commits
  fetcher.on(
    'event',
    async (
      commitId: string,
      userSeed: string,
      operatorSeedHash: string,
      commitOwner: string,
      event: EventLog
    ) => {
      try {
        // Get the operator seed for this commit
        const operatorSeed: string | null = await redisClient.get(commitId);
        if (!operatorSeed) throw new Error('This commit has expired or does not exist.');

        if (process.env.NODE_ENV === 'development') console.log(`Listener: New commit detected [ID: ${commitId}, Owner: ${commitOwner}]`);

        // Check if this commit is ready to be revealed
        if (blockNumber >= event.blockNumber + (confirmations - 1)) {
          // Reveal this commit
          await revealCommit(contract, commitId, operatorSeed, { nonce: await provider.getTransactionCount(await signer.getAddress()) });
        } else {
          // Add this commit to the pending list
          pendingCommits[commitId] = {
            operatorSeed: operatorSeed,
            confirmationBlock: event.blockNumber + (confirmations - 1)
          };
        }
      } catch (e: unknown) {
        if (process.env.NODE_ENV !== 'test') console.error('Listener: Commit reveal error:', e);
      }
    }
  );

  fetcher.start(provider, contract);

  return fetcher;
}

export default listener;
