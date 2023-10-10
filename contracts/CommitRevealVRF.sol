// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import { ICommitRevealVRF } from "./interfaces/ICommitRevealVRF.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title CommitRevealVRF
 * @notice Contract module that allows children to implement a commit-reveal VRF.
 */
abstract contract CommitRevealVRF is ICommitRevealVRF, AccessControl {
    // Import the ECDSA library to enable signature verification
    using ECDSA for bytes32;

    // Define the operator role
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // The number of confirmations required before the commit is revealed
    uint8 public immutable CONFIRMATIONS; // 0 allow revelations to be on the same block, keep caution!

    // Mapping to store commits information
    mapping(bytes32 commitId => Commit commit) public commits;

    constructor(address operator, uint8 confirmations) {
        // Grant the contract deployer the default admin role
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        // Grant the provided operator address the operator role
        _grantRole(OPERATOR_ROLE, operator);

        CONFIRMATIONS = confirmations;
    }

    /**
     * @notice External function for operators to reveal a random seed based on a commitment.
     * @dev This function is intended to be called automatically by the operators.
     * @param commitId The unique identifier of the commitment.
     * @param operatorSeed The operator's seed used for revealing.
     */
    function reveal(
        bytes32 commitId,
        bytes32 operatorSeed
    ) external onlyRole(OPERATOR_ROLE) {
        // Delegate the reveal process to the internal `_reveal` function
        _reveal(commitId, operatorSeed);
    }

    /**
     * @notice External function for operators to reveal random seeds based on multiple commitments.
     * @dev This function is intended to be called automatically by the operators.
     * @param reveals An array of `Reveal` structs containing the commitment id and the operator's seed for each commitment.
     */
    function multiReveal(
        Reveal[] calldata reveals
    ) external onlyRole(OPERATOR_ROLE) {
        // Iterate through the array of reveals and call `_reveal` for each commitment
        for (uint256 i; i < reveals.length; i++) {
            _reveal(reveals[i].commitId, reveals[i].operatorSeed);
        }
    }

    /**
     * @notice Commits the necessary data to initiate the commit-reveal process for obtaining a random seed.
     * @param userSeed User's seed being committed.
     * @param operatorSeedHash Hash of the operator's seed.
     * @param expiration The expiration timestamp for the operator's signed seed hash.
     * @param signature Operator's signature on the data.
     * @return The commit identifier in hash form (bytes32).
     */
    function commit(
        bytes32 userSeed,
        bytes32 operatorSeedHash,
        uint256 expiration,
        bytes memory signature
    ) internal returns (bytes32) {
        // Computes the hash of the message signed by the operator, serving as both the message hash and unique commit identifier
        bytes32 operatorDataHash = keccak256(
            abi.encodePacked(
                keccak256(abi.encodePacked(userSeed)),
                operatorSeedHash,
                msg.sender,
                expiration
            )
        );

        // Revert if the commit already exists
        if (commits[operatorDataHash].commitBlock != 0)
            revert CommitAlreadyExists(operatorDataHash);

        // Revert if the signature is expired
        if (block.timestamp > expiration)
            revert ExpiredCommitSignature(operatorDataHash);

        // Recover the signer address from the provided signature
        address signer = operatorDataHash.toEthSignedMessageHash().recover(
            signature
        );

        // Revert if the signer is not a valid operator
        if (hasRole(OPERATOR_ROLE, signer) != true)
            revert InvalidCommitSignature(operatorDataHash);

        // Save the commit information
        commits[operatorDataHash] = Commit({
            userSeed: userSeed,
            operatorSeedHash: operatorSeedHash,
            commitOwner: msg.sender,
            commitBlock: uint96(block.number + uint256(CONFIRMATIONS))
        });

        // Emit an event to notify the operator about the new commitment
        emit SeedCommitted(
            operatorDataHash,
            userSeed,
            operatorSeedHash,
            msg.sender
        );

        // Returns `operatorDataHash` as both the signed message hash and unique commit identifier in `commits` mapping
        return operatorDataHash;
    }

    /**
     * @notice Callback function intended to be overridden in child contracts to handle the revealed random seed.
     * @param commitId The unique identifier of the commitment.
     * @param randomSeed The verifiable random seed.
     */
    function revealCallback(
        bytes32 commitId,
        bytes32 randomSeed
    ) internal virtual {} // solhint-disable-line no-empty-blocks

    /**
     * @notice This function verifies the commit, calculates the random seed, and handles the reveal process.
     * @param commitId The unique identifier of the commitment.
     * @param operatorSeed The operator's seed used for revealing.
     */
    function _reveal(bytes32 commitId, bytes32 operatorSeed) private {
        // Ensure that the specified commit exists in the `commits` mapping
        if (commits[commitId].commitBlock == 0)
            revert CommitDoesNotExist(commitId);

        // Get the commit information
        Commit storage _commit = commits[commitId];

        // Ensure that the revelation is not made in the same block as the commitment
        if (block.number < _commit.commitBlock)
            revert InvalidRevealBlock(
                commitId,
                _commit.commitBlock,
                block.number
            );

        // Ensure that the operator's seed matches the hash stored in the commit
        if (
            keccak256(abi.encodePacked(operatorSeed)) !=
            _commit.operatorSeedHash
        )
            revert InvalidOperatorSeed(
                commitId,
                _commit.operatorSeedHash,
                operatorSeed
            );

        // Calculate the random seed using the user's seed, operator's seed, and the previous block's hash
        bytes32 randomSeed = keccak256(
            abi.encodePacked(
                _commit.userSeed,
                operatorSeed,
                blockhash(block.number - 1)
            )
        );

        // Delete the commit information
        delete commits[commitId];

        // Emit an event to log the revealed seed
        emit SeedRevealed(commitId, operatorSeed, randomSeed);

        // Perform a callback for further processing
        revealCallback(commitId, randomSeed);
    }
}
