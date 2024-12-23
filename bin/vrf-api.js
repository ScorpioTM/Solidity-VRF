#!/usr/bin/env node

// Load environment variables from a .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { router } = require('../dist');

const app = express();
const port = process.env.OPERATOR_API_PORT || 8080;

// Enable CORS for all origins
app.use(cors());

// Set up routes and configuration using the `router` function
app.use(
  '/',
  router({
    redisUrl: process.env.OPERATOR_API_REDIS_URL || 'redis://127.0.0.1:6379',
    jsonRpcUrl: process.env.OPERATOR_API_PROVIDER_URL || 'http://127.0.0.1:8545/',
    privateKey: process.env.OPERATOR_API_PRIVATE_KEY,
    vrfAddress: process.env.OPERATOR_API_CONTRACT_ADDRESS,
    expiration: Number(process.env.OPERATOR_API_SEED_EXPIRATION) || 900,
    confirmations: Number(process.env.OPERATOR_API_COMMIT_CONFIRMATIONS) || 3
  })
);

// Start the API server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`VRF API listening at http://127.0.0.1:${port}/`);
  });
}

// Export the app (For testing only)
if (process.env.NODE_ENV === 'test') module.exports = app;
