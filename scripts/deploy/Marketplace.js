const { ethers } = require('hardhat');
require("dotenv").config();
const { STAGE } = process.env;

async function deployMarketplace() {
  const marketplace = await ethers.deployContract("Marketplace");
  await marketplace.waitForDeployment();

  return marketplace;
}

module.exports = {
    deployMarketplace
}