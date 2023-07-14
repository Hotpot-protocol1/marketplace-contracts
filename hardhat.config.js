//require("@nomiclabs/hardhat-waffle");
require('@nomiclabs/hardhat-ethers');
require("@nomicfoundation/hardhat-chai-matchers");
//require('@nomicfoundation/hardhat-toolbox');
require("hardhat-gas-reporter");
require('dotenv').config();

const {
  INFURA_SEPOLIA_API, INFURA_MAINNET_API, STAGE, MNEMONIC
} = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
        optimizer: {
            enabled: true,
            runs: 200
        }
    }
  },

  networks: {
    hardhat: {
        forking: {
            url: INFURA_MAINNET_API,
            blockNumber: 17485589,
        },
        accounts: {
          accountsBalance: "20000000000000000000000" // 20000 ETH
        }
    },
    sepolia: {
      url: INFURA_SEPOLIA_API,
      accounts: {
        mnemonic: MNEMONIC,
        initialIndex: 0,
        count: 1
      }
      
    }
  },

  gasReporter: {
    currency: 'USD',
    gasPrice: 21
  }
  
};
