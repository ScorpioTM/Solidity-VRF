#!/usr/bin/env node
const { ethers } = require("hardhat");

const wallet = ethers.Wallet.createRandom();
console.log('Address:', wallet.address);
console.log('Private Key:', wallet.privateKey);