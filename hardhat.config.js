require('@nomiclabs/hardhat-ethers');
require("@nomicfoundation/hardhat-chai-matchers");
require("hardhat-gas-reporter");
require('dotenv').config();
require('hardhat-contract-sizer');

const {
  INFURA_MAINNET_API, STAGE, MNEMONIC, INFURA_GOERLI_API
} = process.env;

let forking_url;
let forking_block_number;

if (STAGE == "FORK_TESTING") {
  forking_url = INFURA_MAINNET_API;
  forking_block_number = 17704555;
}

task("sigverify", "Verify pending amounts", async (taskArgs, hre) => {
  const sig = "0x6e26a1ade620b79826071d18ca5c4569bf166aca9d7cb792f70a0457a0af896823e612f11169d771fb18626dc1878334866464a7c3029c1d132beef89dde571b1c";
  const value = {
    offererPendingAmount: 0,
    buyerPendingAmount: 0,
    orderHash: "0xef5d923c3a25e3f22c219350cd9ae30b3a25e19cd471d0aa7f54112af379eea2"
  };
  const pendingAmountType = {
    PendingAmountData: [
      { name: 'offererPendingAmount', type: 'uint256' },
      { name: 'buyerPendingAmount', type: 'uint256' },
      { name: 'orderHash', type: 'bytes32' },
    ],
  };
  const marketplace = "0x2164b06F71Ad3Ebb5AA1E31ccb3d7EF69ce8Be05";
  const domain = {
    name: process.env.PROTOCOL_NAME,
    version: process.env.PROTOCOL_VERSION,
    chainId: 5, // goerli
    verifyingContract: marketplace
  };
  const domain_separator = hre.ethers.TypedDataEncoder.hashDomain(domain);
  const pa_hash = hre.ethers.TypedDataEncoder.hash(
    domain, pendingAmountType, value
  );
  console.log('Domain:', domain);
  console.log('Domain separator: ', domain_separator);
  console.log('Pending amount hash: ', pa_hash);

  const signer = hre.ethers.verifyTypedData(domain, pendingAmountType, value, sig);
  console.log('Operaator? ', signer);

});

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
    },
    goerli: {
      url: INFURA_GOERLI_API
    }
  },

  gasReporter: {
    currency: 'USD',
    gasPrice: 21
  },

  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
  }
  
};
