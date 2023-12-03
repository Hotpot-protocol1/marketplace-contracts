const hre = require("hardhat");

async function main() {

  const [deployer] = await hre.ethers.getSigners();

  if (!deployer) {
    throw new Error("Incorrect deployer");
  }

  const marketplace = await deployMarketplaceImplementation(deployer);
  const deployer_addr = await deployer.getAddress();

  console.log(`Marketplace logic contract deployed at ${marketplace.target}`);
  console.log(`Deployer: ${deployer_addr}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});