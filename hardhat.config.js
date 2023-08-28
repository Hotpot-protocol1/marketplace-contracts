const { listingTypes } = require('./scripts/utils/EIP712_types');

require('@nomiclabs/hardhat-ethers');
require("@nomicfoundation/hardhat-chai-matchers");
require("hardhat-gas-reporter");
require('dotenv').config();


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
  const sig = "0x2c706b13d7194f5f6302a2e587d0d4582560d8f17111f05b59e8067047756a00354be8be844bf72c2197827e5b3f80fa35dd6111bb0e5dbe2f0895d201c358921c";
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
  const pa_hashstruct = hre.ethers.TypedDataEncoder.hashStruct(
    "PendingAmountData", pendingAmountType, value
  );

  /* 
    Getting an order hash
   */
  const order = {
    offerer: "0x45efE45e5F5c856CaD0C9907eF01CAC36c8fe88a",
	  offerItem: {
      offerToken: "0x55583fbb4c6c6640b4a072376aa28fe3c7c20b7f",
      offerTokenId: 7n,
      offerAmount: 1000000000000000n,
      endTime: 1695368821n, 
	  }, 
    royalty: {
      royaltyPercent: 50n, 
      royaltyRecipient: "0x2164b06F71Ad3Ebb5AA1E31ccb3d7EF69ce8Be05",
    },
    salt: 925n
  };
  const order_hash = hre.ethers.TypedDataEncoder.hash(
    domain, listingTypes, order
  );
  

  console.log('Domain:', domain);
  console.log('Domain separator: ', domain_separator);
  console.log('Pending amount hash: ', pa_hash);
  console.log('Pending amount hashstruct: ', pa_hashstruct);
  console.log('Order EIP712 hash: ', order_hash);

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
  }
  
};
