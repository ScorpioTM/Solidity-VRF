# Solidity VRF (Verifiable Random Function)

The `solidity-vrf` package is a comprehensive suite of tools and smart contracts designed to enable secure and transparent generation of random numbers using a commit-reveal scheme in Solidity. This suite includes a core [smart contract](#smart-contract), an [Express.js middleware](#express-middleware), and some utilities for testing.

# Table of Contents

- [Solidity VRF (Verifiable Random Function)](#solidity-vrf-verifiable-random-function)
- [Table of Contents](#table-of-contents)
- [Usage](#usage)
- [Installation](#installation)
- [Test Server](#test-server)
- [Smart Contract](#smart-contract)
  - [Usage](#usage-1)
    - [Example](#example)
  - [Functions](#functions)
    - [Function **`commit`**](#function-commit)
      - [Description](#description)
      - [Parameters](#parameters)
      - [Returns](#returns)
    - [Function **`reveal`**](#function-reveal)
      - [Description](#description-1)
      - [Parameters](#parameters-1)
    - [Function **`multiReveal`**](#function-multireveal)
      - [Description](#description-2)
      - [Parameters](#parameters-2)
    - [Function **`revealCallback`**](#function-revealcallback)
      - [Description](#description-3)
      - [Parameters](#parameters-3)
- [Express.js Middleware](#expressjs-middleware)
  - [Usage](#usage-2)
    - [Example](#example-1)
  - [Endpoints](#endpoints)
    - [POST **`/commit`**](#post-commit)
      - [Request Parameters](#request-parameters)
      - [Response](#response)
- [License](#license)

# Usage

To use the `solidity-vrf` package, follow these steps:

1. Install the `solidity-vrf` package in your project. For more information, see [`Installation`](#installation).

2. Use the [`CommitRevealVRF`](#smart-contract) smart contract for random number generation by creating a child smart contract. Detailed usage instructions are available in the [`Smart Contract Usage`](#usage-1) section.

3. Integrate the [`Express.js Middleware`](#expressjs-middleware) into your application for secure random seed commitments and reveals. Configuration details can be found in the [`Express.js Middleware Usage`](#usage-2) section.

# Installation

To install the `solidity-vrf` package, you can use the following command:

```sh
npm install --save-dev solidity-vrf
```

# Test Server

To start a test server with the [`Express.js Middleware`](#expressjs-middleware) and explore its capabilities in a controlled environment, use the following command:

```sh
npx vrf-api
```

# Smart Contract

The [`CommitRevealVRF`](#smart-contract) smart contract provides a foundation for implementing a commit-reveal based Verifiable Random Function (VRF) in Solidity. It allows developers to create a function that users can call to invoke the [`commit`](#function-commit) function, and operators can trigger the [`reveal`](#function-reveal) function at a later time, subsequently enabling the validation of the revealed seed's authenticity.

The contract is designed to be extendable, allowing developers to build specific applications on top of it. This README provides an overview of the contract, its key features, and how to use it.

## Usage

To use the [`CommitRevealVRF`](#smart-contract) smart contract, follow these steps:

1. Import the [`CommitRevealVRF`](#smart-contract) contract into your Solidity contract:

   ```solidity
   // Import the `CommitRevealVRF` contract
   import { CommitRevealVRF } from "solidity-vrf/contracts/CommitRevealVRF.sol";
   ```

2. Create a child contract that extends the [`CommitRevealVRF`](#smart-contract) contract:

   ```solidity
   contract Example CommitRevealVRF {}
   ```

3. Implement a function to initiate commitments and the commit-reveal process. You can wrap or override the [`commit`](#function-commit) function as needed:

   ```solidity
   // Function for a user to make a commitment and initiate the commit-reveal process
   function makeCommitment(bytes32 userSeed, bytes32 operatorSeedHash, uint256 expiration, bytes memory signature) external {
       // Call the `commit` function to initiate the commit-reveal process
       bytes32 commitId = commit(userSeed, operatorSeedHash, expiration, signature);

       // Perform any additional actions after making the commitment
   }
   ```

4. Customize the handling of revealed random seeds by overriding the [`revealCallback`](#function-revealcallback) function in your child contract:

   ```solidity
   // Override the `revealCallback` function for custom logic
   function revealCallback(bytes32 commitId, bytes32 randomSeed) internal override {
       // Implement your custom logic here to handle the random seed
   }
   ```

### Example

Here's the complete example of how to use the [`CommitRevealVRF`](#smart-contract) smart contract.

```solidity
pragma solidity ^0.8.18;

// Import the `CommitRevealVRF` contract
import { CommitRevealVRF } from "solidity-vrf/contracts/CommitRevealVRF.sol";

contract Example is CommitRevealVRF {
    // Constructor to deploy the contract
    constructor(address operator, uint8 confirmations) CommitRevealVRF(operator, confirmations) {}

    // Function for a user to make a commitment and initiate the commit-reveal process
    function makeCommitment(bytes32 userSeed, bytes32 operatorSeedHash, uint256 expiration, bytes memory signature) external {
        // Call the `commit` function to initiate the commit-reveal process
        bytes32 commitId = commit(userSeed, operatorSeedHash, expiration, signature);

        // Perform any additional actions after making the commitment
    }

    // Override the `revealCallback` function for custom logic
    function revealCallback(bytes32 commitId, bytes32 randomSeed) internal override {
        // Implement your custom logic here to handle the random seed
    }
}
```

This code demonstrates how to use the [`CommitRevealVRF`](#smart-contract) smart contract in your Solidity contract. After installing the `solidity-vrf` package, you can import the [`CommitRevealVRF`](#smart-contract) contract and create a child contract that extends it. This child contract allows users to make commitments using the `makeCommitment` function, which internally invokes the [`commit`](#function-commit) function for secure commitment processing. Additionally, it provides an opportunity to customize the handling of revealed random seeds in the [`revealCallback`](#function-revealcallback) function.

Make sure to adapt the code according to your specific use case and requirements.

## Functions

### Function **`commit`**

```solidity
function commit(bytes32 userSeed, bytes32 operatorSeedHash, uint256 expiration, bytes memory signature) internal returns (bytes32)
```

#### Description

Commits the necessary data to initiate the commit-reveal process for obtaining a random seed.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `userSeed` | `bytes32` | User's seed being committed. |
| `operatorSeedHash` | `bytes32` | Hash of the operator's seed. |
| `expiration` | `uint256` | The expiration timestamp for the operator's signed seed hash. |
| `signature` | `bytes memory` | Operator's signature on the data. |

#### Returns

| Name | Type | Description |
| ---- | ---- | ----------- |
| `commitId` | `bytes32` | The commit identifier in hash form. |

### Function **`reveal`**

```solidity
function reveal(bytes32 commitId, bytes32 operatorSeed) external
```

#### Description

External function for operators to reveal a random seed based on a commitment.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `commitId` | `bytes32` | The unique identifier of the commitment. |
| `operatorSeed` | `bytes32` | The operator's seed used for revealing. |

### Function **`multiReveal`**

```solidity
function multiReveal(Reveal[] calldata reveals) external
```

#### Description

External function for operators to reveal random seeds based on multiple commitments.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `reveals` | `Reveal[] calldata` | An array of `Reveal` structs containing the commitment id and the operator's seed for each commitment. |

### Function **`revealCallback`**

```solidity
function revealCallback(bytes32 commitId, bytes32 randomSeed) internal virtual
```

#### Description

Callback function intended to be overridden in child contracts to handle the revealed random seed.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `commitId` | `bytes32` | The unique identifier of the commitment. |
| `randomSeed` | `bytes32` | The verifiable random seed. |

# Express.js Middleware

This [`Express.js Middleware`](#expressjs-middleware) provides an API for committing to random seeds and retrieving revealed seeds.

## Usage

To use the [`Express.js Middleware`](#expressjs-middleware), follow these steps:

1. Import the `router` middleware from the `solidity-vrf` package:

   ```javascript
   // Import the `router` middleware
   const { router } = require("solidity-vrf");
   ```

2. Include the `router` middleware in your Express.js application:

   ```javascript
   const express = require("express");
   const app = express();

   // Include the `router` middleware
   app.use("/", router({
     redisUrl: "redis://<REDIS_HOST>:<REDIS_PORT>",
     jsonRpcUrl: "<JSON_RPC_URL>",
     privateKey: "<PRIVATE_KEY>",
     vrfAddress: "<CONTRACT_ADDRESS>",
     expiration: 900,
     confirmations: 3
   }));
   ```

3. Start your Express.js server:

   ```javascript
   // Start your Express.js server
   app.listen(8080, () => {
     console.log("VRF API listening at http://127.0.0.1:8080/");
   });
   ```

*For additional details on endpoints and responses, refer to the [`Endpoints`](#endpoints) section.*

### Example

Here's the complete example of how to use the middleware in your Express.js application, including the required configurations.

```javascript
const express = require("express");
const app = express();

// Import the `router` middleware
const { router } = require("solidity-vrf");

// Include the `router` middleware
app.use("/", router({
   redisUrl: "redis://<REDIS_HOST>:<REDIS_PORT>",
   jsonRpcUrl: "<JSON_RPC_URL>",
   privateKey: "<PRIVATE_KEY>",
   vrfAddress: "<CONTRACT_ADDRESS>",
   expiration: 900,
   confirmations: 3
}));

// Start your Express.js server
app.listen(8080, () => {
  console.log("VRF API listening at http://127.0.0.1:8080/");
});
```

Customize the code as needed for your specific use case.

## Endpoints

### POST **`/commit`**

You can commit to a random seed by sending a POST request to the `/commit` endpoint.

#### Request Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `address` | `Hexadecimal string` | The Ethereum address of the user for whom the seed is being committed. |
| `hash` | `Hexadecimal string` | The hash of the user's seed to be committed. |

#### Response

Upon a successful commitment, the middleware will respond with a JSON object containing the following fields:

| Name | Type | Description |
| ---- | ---- | ----------- |
| `commit_id` | `Hexadecimal string` | The unique commit identifier (commit ID). |
| `seed_hash` | `Hexadecimal string` | The hash of the operator seed. |
| `signature` | `Hexadecimal string` | TThe operator's signature. |
| `expiration` | `Number` | The expiration timestamp of the commitment. |

# License

This project is licensed under the [MIT License](LICENSE).