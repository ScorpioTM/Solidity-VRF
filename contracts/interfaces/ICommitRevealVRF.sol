// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/**
 * @title ICommitRevealVRF
 * @notice Contract module that allows children to implement a commit-reveal VRF.
 */
interface ICommitRevealVRF {
    /**
     * @notice Struct to store commitment data.
     * @param userSeed User's seed for the commitment.
     * @param operatorSeedHash Hash of the operator's seed.
     * @param commitOwner Address of the commitment owner.
     * @param commitBlock Block number when the commitment was made.
     */
    struct Commit {
        bytes32 userSeed;
        bytes32 operatorSeedHash;
        address commitOwner;
        uint96 commitBlock;
    }

    /**
     * @notice Struct to store reveal data.
     * @param commitId Unique identifier of the commitment.
     * @param operatorSeed Operator's seed used for revealing.
     */
    struct Reveal {
        bytes32 commitId;
        bytes32 operatorSeed;
    }

    error CommitAlreadyExists(bytes32 commitId);
    error CommitDoesNotExist(bytes32 commitId);
    error ExpiredCommitSignature(bytes32 commitId);
    error InvalidCommitSignature(bytes32 commitId);
    error InvalidRevealBlock(
        bytes32 commitId,
        uint256 commitBlock,
        uint256 revealBlock
    );
    error InvalidOperatorSeed(
        bytes32 commitId,
        bytes32 operatorSeedHash,
        bytes32 operatorSeed
    );

    /**
     * @notice Event to log a commitment.
     * @param commitId Unique identifier of the commitment.
     * @param userSeed User's seed for the commitment.
     * @param operatorSeedHash Hash of the operator's seed.
     * @param commitOwner Address of the commitment owner.
     */
    event SeedCommitted(
        bytes32 commitId,
        bytes32 userSeed,
        bytes32 operatorSeedHash,
        address commitOwner
    );

    /**
     * @notice Event to log the reveal of a commitment and the resulting random seed.
     * @param commitId Unique identifier of the commitment.
     * @param operatorSeed Operator's seed used for revealing.
     * @param randomSeed The revealed random seed.
     */
    event SeedRevealed(
        bytes32 commitId,
        bytes32 operatorSeed,
        bytes32 randomSeed
    );

    // Define the operator role
    function OPERATOR_ROLE() external returns (bytes32);

    // The number of confirmations required before the commit is revealed
    function CONFIRMATIONS() external returns (uint8);

    // Mapping to store commits information
    function commits(
        bytes32 commitId
    ) external returns (
        bytes32 userSeed,
        bytes32 operatorSeedHash,
        address commitOwner,
        uint96 commitBlock
    );

    /**
     * @notice External function for operators to reveal a random seed based on a commitment.
     * @dev This function is intended to be called automatically by the operators.
     * @param commitId The unique identifier of the commitment.
     * @param operatorSeed The operator's seed used for revealing.
     */
    function reveal(bytes32 commitId, bytes32 operatorSeed) external;

    /**
     * @notice External function for operators to reveal random seeds based on multiple commitments.
     * @dev This function is intended to be called automatically by the operators.
     * @param reveals An array of `Reveal` structs containing the commitment id and the operator's seed for each commitment.
     */
    function multiReveal(Reveal[] calldata reveals) external;
}
