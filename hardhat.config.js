//require("@nomiclabs/hardhat-waffle");
require('@nomiclabs/hardhat-ethers');
require("@nomicfoundation/hardhat-chai-matchers");
//require('@nomicfoundation/hardhat-toolbox');
require("hardhat-gas-reporter");
require('dotenv').config();

const {
  INFURA_SEPOLIA_API, INFURA_MAINNET_API, STAGE, MNEMONIC, XDC_API
} = process.env;

let forking_url;
let forking_block_number;

if (STAGE == "FORK_TESTING") {
  forking_url = INFURA_MAINNET_API;
  forking_block_number = 17704555;
}
else if (STAGE == "XDC_FORK_TESTING") {
  forking_url = XDC_API;
  //forking_block_number = 63208724;
}

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
          url: forking_url,
          blockNumber: forking_block_number,
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
