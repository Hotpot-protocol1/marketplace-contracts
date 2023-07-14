const hre = require("hardhat");
const { deployHotpotFactory } = require('./deploy/HotpotFactory');
const { deployHotpotImplementation } = require('./deploy/HotpotImplementation.js');

const { STAGE } = require("dotenv").config();

async function main() {
  await deployHotpotImplementation();
  //await deployHotpotFactory();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
