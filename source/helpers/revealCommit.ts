import { ethers } from 'ethers';

/**
 * Specifies optional overrides for contract method calls.
 */
interface ContractMethodOverrides {
  /**
   * The gas price to use for the transaction, specified as a numeric value.
   */
  gasPrice?: ethers.Numeric;
  /**
   * The gas limit for the transaction, specified as a numeric value.
   */
  gasLimit?: ethers.Numeric;

  /**
   * The nonce to use for the transaction, specified as a numeric value.
   */
  nonce?: ethers.Numeric;
}

/**
 * Reveals a commitment in a Solidity smart contract.
 *
 * @param contract The Solidity smart contract with the 'reveal' method to be used for revealing the commitment.
 * @param commit_id The unique identifier of the commitment to be revealed.
 * @param operatorSeed The operator's seed used for the revelation.
 * @param args (Optional) An object that provides additional options, such as gas price and gas limit.
 * @returns An object containing the operator's seed and the transaction hash.
 * @throws Error if the reveal transaction is reverted or if any other error occurs.
 */
export async function revealCommit(contract: ethers.Contract, commit_id: string, operatorSeed: string, args: ContractMethodOverrides = {}): Promise<{ seed: string, transaction: string }> {
  try {
    // Set the overrides to be used on the reveal transaction
    const overrides: ContractMethodOverrides = {};
    if (args.gasPrice) overrides.gasPrice = args.gasPrice;
    if (args.gasLimit) overrides.gasLimit = args.gasLimit;
    if (args.nonce) overrides.nonce = args.nonce;

    // Attempt to perform the reveal transaction by calling the `reveal` method of the smart contract
    const revealResponse: ethers.ContractTransactionResponse = await contract.reveal(commit_id, operatorSeed, overrides);

    // Wait for the transaction to be confirmed
    const revealReceipt: ethers.ContractTransactionReceipt | null = await revealResponse.wait();

    // Check if the transaction status is not successful
    if (!revealReceipt || !revealReceipt.status) {
      throw new Error('The reveal transaction was reverted.');
    }

    // Return the operator's seed and the transaction hash.
    return {
      seed: operatorSeed,
      transaction: revealResponse.hash
    };
  } catch (e: unknown) {
    // Handle different types of errors
    if (ethers.isError(e, 'CALL_EXCEPTION')) {
      // Handle `require` errors
      if (e.reason) {
        throw new Error(`revealCommit: A call exception error occurred while trying to reveal the commit. (Reason: ${e.reason})`);
      } else if (e.revert) {
        throw new Error(`revealCommit: A call exception error occurred while trying to reveal the commit. (Name: ${e.revert.name}), Arguments: ['${e.revert.args.join(', ')}']`);
      } else {
        throw new Error('revealCommit: A unknown call exception error occurred while trying to reveal the commit.', { cause: e });
      }
    } else if (ethers.isError(e, 'INSUFFICIENT_FUNDS')) {
      throw new Error('revealCommit: Insufficient funds for this transaction');
    } else if (ethers.isError(e, 'NONCE_EXPIRED')) {
      throw new Error('revealCommit: This nonce is already used in a transaction');
    } else if (ethers.isError(e, 'NETWORK_ERROR')) {
      if (e.event) throw new Error(`revealCommit: Can't connect to the network (Event: ${e.event})`);
      throw new Error(`revealCommit: Can't connect to the network`);
    } else if (ethers.isError(e, 'TIMEOUT')) {
      throw new Error('revealCommit: Transaction timed out');
    } else if (e instanceof Error) {
      throw new Error(e.message);
    } else {
      throw new Error('revealCommit: An unknown error occurred while trying to reveal the commit.');
    }
  }
}

export default revealCommit;