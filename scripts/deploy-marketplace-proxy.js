const { deployMarketplaceImplementation } = require('./deploy/Marketplace');
const hre = require("hardhat");
const { TRADE_FEE } = require('./utils/parameters');

async function main() {

  const [deployer] = await hre.ethers.getSigners();

  if (!deployer) {
    throw new Error("Incorrect deployer");
  }
  const operator_address = process.env.OPERATOR;
  if (!operator_address) {
    throw new Error("Configure operator address");
  }

  /*
    IMPLEMENTATION 
   */
  console.log("Deploying logic contract...");
  const MarketplaceImpl = await deployMarketplaceImplementation(deployer);

  console.log(`Marketplace logic contract deployed at ${MarketplaceImpl.target}`);
  console.log('Verifying logic contract...');
  await new Promise((resolve) => setTimeout(resolve, 30000));
  await hre.run("verify:verify", {
    address: MarketplaceImpl.target,
    constructorArguments: [],
  });

  /* 
    PROXY
   */

  console.log("Deploying proxy...");

  const initialize_calldata = MarketplaceImpl.interface.encodeFunctionData(
    "initialize", [
    TRADE_FEE,
    operator_address
  ]);
  const marketplaceProxy = await ethers.deployContract("MarketplaceProxy", [
    MarketplaceImpl.target,
    initialize_calldata
  ]);
  await marketplaceProxy.waitForDeployment();

  console.log("Marketplace proxy deployed at", marketplaceProxy.target);
  console.log("Verifying proxy...");

  await new Promise((resolve) => setTimeout(resolve, 30000));
  await hre.run("verify:verify", {
    address: marketplaceProxy.target,
    constructorArguments: [
      MarketplaceImpl.target,
      initialize_calldata
    ],
  });

  const deployer_addr = await deployer.getAddress();
  console.log(`Deployer: ${deployer_addr}`);
  
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});