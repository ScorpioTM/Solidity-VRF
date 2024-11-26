require("@nomicfoundation/hardhat-toolbox");
require('hardhat-exposed');
require('dotenv').config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  networks: {
    hardhat: {
      mining: {
        mempool: {
          order: "fifo"
        }
      }
    }
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
    currency: process.env.GAS_REPORT_CURRENCY ? process.env.GAS_REPORT_CURRENCY : 'USD',
    token: process.env.GAS_REPORT_TOKEN ? process.env.GAS_REPORT_TOKEN : 'ETH',
    gasPriceApi: process.env.GAS_REPORT_GAS_PRICE_API ? process.env.GAS_REPORT_GAS_PRICE_API : 'https://api.etherscan.io/api?module=proxy&action=eth_gasPrice',
    coinmarketcap: process.env.GAS_REPORT_COINMARKETCAP_API_KEY ? process.env.GAS_REPORT_COINMARKETCAP_API_KEY : '',
    showMethodSig: true
  }
};
