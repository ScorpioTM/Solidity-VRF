#!/usr/bin/env node
require('dotenv').config();
const express = require("express");
const { router } = require('../dist');

const app = express();
const port = process.env.OPERATOR_API_PORT || 8080;

app.use('/', router({
  redisUrl: process.env.OPERATOR_API_REDIS_URL || "redis://127.0.0.1:6379",
  jsonRpcUrl: process.env.OPERATOR_API_PROVIDER_URL || "http://127.0.0.1:8545/",
  privateKey: process.env.OPERATOR_API_PRIVATE_KEY,
  vrfAddress: process.env.OPERATOR_API_CONTRACT_ADDRESS,
  expiration: Number(process.env.OPERATOR_API_SEED_EXPIRATION) || 900,
  confirmations: Number(process.env.OPERATOR_API_COMMIT_CONFIRMATIONS) || 3
}));

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`VRF API listening at http://127.0.0.1:${port}/`);
  });
}

// Export the app (For testing only)
if (process.env.NODE_ENV === 'test') module.exports = app;