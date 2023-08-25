require('@nomiclabs/hardhat-ethers');
require("@nomicfoundation/hardhat-chai-matchers");
require("hardhat-gas-reporter");
require('dotenv').config();


const {
  INFURA_MAINNET_API, STAGE, MNEMONIC
} = process.env;

let forking_url;
let forking_block_number;

if (STAGE == "FORK_TESTING") {
  forking_url = INFURA_MAINNET_API;
  forking_block_number = 17704555;
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.21",
    settings: {
        optimizer: {
            enabled: true,
            runs: 10000
        }
    }
  },

  networks: {
    hardhat: {
        forking: {
          url: forking_url,
          blockNumber: forking_block_number,
        },
        accounts: {
          accountsBalance: "20000000000000000000000" // 20000 ETH
        }
    }
  },

  gasReporter: {
    currency: 'USD',
    gasPrice: 21
  }
  
};
