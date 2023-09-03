const { listingTypes } = require('./scripts/utils/EIP712_types');

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

task("fulfillorder-gas-est", "Estimate gas limit for a fulfill order tx", async (taskArgs, hre) => {
  
  /* 
    get Marketplace instance
   */
  const marketplace_addr = "0x2164b06f71ad3ebb5aa1e31ccb3d7ef69ce8be05";
  const artifact = await hre.artifacts.readArtifact("Marketplace");
  const marketplace = await ethers.getContractAtFromArtifact(
    artifact, 
    marketplace_addr
  );

  /* 
    get a signer
   */
  //const wallet = ethers.Wallet.fromPhrase(MNEMONIC, hre.network.provider);
  const [user1] = await ethers.getSigners();
  const user1_address = await user1.getAddress();
  console.log('Caller: ', user1_address);
  /* 
    Create method parameters
   */
  const params = {
    offerer: "0x9ca68dd2249b8db4e7a8567481d3270d903b7640",
    offerItem: {
      offerToken: "0x55583fbb4c6c6640b4a072376aa28fe3c7c20b7f",
      offerTokenId: 8,
      offerAmount: 100000000000000n,
      endTime: 1695953000n
    },
    royalty: {
      royaltyPercent: 1,
      royaltyRecipient: "0x7092e63d04930fa96cd9912760500b5f21c9aa8a"
    },
    pendingAmountsData: {
      offererPendingAmount: 20505030000000000n,
      buyerPendingAmount: 0,
      orderHash: "0x001f91851b722ddad7675feee5f547c12932147f21e9373c163a3651ce70c157"
    },
    salt: 122,
    orderSignature: "0xf49b7e4740cb47dfaafdd0f23a53f081ed4dfb73815ad99245c61ae47e86b39629205eaff584435abf05bbf370f76ea98c1ab77dddcca91c84ce61f55cbcc5d61c",
    pendingAmountsSignature: "0xb327ad3c18b6c6fe7171be94f7cab9797acade6c03016837544065c2eb1b008d69e9847acc545189ba29d6c9523ba06cfcaba75b5bf84f45df3d26c5554c59aa1b"
  }
  // call
  //await marketplace.connect(wallet).fulfillOrder(params);
  const tx = {
    data: "0xbd2cd3dc000000000000000000000000000000000000000000000000000000000000002000000000000000000000000045efe45e5f5c856cad0c9907ef01cac36c8fe88a00000000000000000000000055583fbb4c6c6640b4a072376aa28fe3c7c20b7f000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000038d7ea4c680000000000000000000000000000000000000000000000000000000000065168a0b00000000000000000000000000000000000000000000000000000000000000010000000000000000000000007092e63d04930fa96cd9912760500b5f21c9aa8a0000000000000000000000000000000000000000000000000048eb96fa4ae0000000000000000000000000000000000000000000000000000000092fd2845200cef565ac0dd05fe8211abc767977685e7bed983b8265774bc2373a6cd5a149c3000000000000000000000000000000000000000000000000000000000000039e00000000000000000000000000000000000000000000000000000000000001a000000000000000000000000000000000000000000000000000000000000002200000000000000000000000000000000000000000000000000000000000000041c17cc30531987d0628d64fd6a3502bc048d3edd1ceada67ff1b78afd0970cc75117bdca058af9afcfa7e04bee3bd653b66ea4faa2b09e0035d3cc971b5dd103a1b00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004179701506065924a7a874c301372678305422a6ce575a7960cacda3d1cec4547a42860cba191edee9e5f162f275d701caf5f95952c253431373cbe8305dd2e34a1c00000000000000000000000000000000000000000000000000000000000000",
    from: "0xe2D3f8c3C5597736ea34F1A24C6D3C9000e9796e",
    to: marketplace_addr,
    value: ethers.parseEther("0.001112"),
  };
  const gas = await user1.estimateGas(tx);
  console.log('Gas estimation: ', gas);
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
      url: INFURA_GOERLI_API,
      chainId: 5,
      accounts: {
        mnemonic: MNEMONIC,
        count: 2,
      }
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
