import { ethers } from 'ethers';

interface ContractMethodOverrides {
  gasPrice?: ethers.Numeric;
  gasLimit?: ethers.Numeric;
}

export async function revealCommit(contract: ethers.Contract, commit_id: string, operatorSeed: string, args: ContractMethodOverrides = {}): Promise<{ seed: string, transaction: string }> {
  try {
    const revealResponse: ethers.ContractTransactionResponse = await contract.reveal(commit_id, operatorSeed, { gasPrice: args.gasPrice, gasLimit: args.gasLimit });

    // Wait for the transaction to be confirmed
    const revealReceipt: ethers.ContractTransactionReceipt | null = await revealResponse.wait();

    if (!revealReceipt || !revealReceipt.status) {
      throw new Error('The reveal transaction was reverted.');
    }

    return {
      seed: operatorSeed,
      transaction: revealResponse.hash
    };
  } catch (e: unknown) {
    if (ethers.isCallException(e)) {
      throw new Error('A call exception error occurred while trying to reveal the commit. (Error name: ' + e.revert + ')');
    } else if (e instanceof Error) {
      throw new Error(e.message);
    } else {
      throw new Error('An unknown error occurred while trying to reveal the commit.');
    }
  }
}

export default revealCommit;