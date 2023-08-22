const { ethers } = require('hardhat');
const {
  TRADE_FEE,
} = require("../utils/parameters.js");

async function deployMarketplace(operator_address) {
  const MarketplaceImpl = await deployMarketplaceImplementation();

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
  
  const artifact = await hre.artifacts.readArtifact("Marketplace");
  const marketplace = await ethers.getContractAtFromArtifact(
    artifact, 
    marketplaceProxy.target
  );

  return marketplace;
}

async function deployMarketplaceImplementation() {
  const marketplace = await ethers.deployContract("Marketplace");
  await marketplace.waitForDeployment();
  return marketplace;
}

module.exports = {
    deployMarketplace
}