const hre = require("hardhat");
const {network} = require("hardhat");
const {LINK, VRFV2Wrapper} = require("../Addresses");

async function main() {

  const [deployer] = await hre.ethers.getSigners();

  if (!deployer) {
    throw new Error("Incorrect deployer");
  }

  const hotpot_impl = await ethers.deployContract("Hotpot", [
    LINK[network.config.chainId],
    VRFV2Wrapper[network.config.chainId]
  ]);
  await hotpot_impl.waitForDeployment();
  const deployer_addr = await deployer.getAddress();

  console.log(`Hotpot logic contract deployed at ${hotpot_impl.target}`);
  console.log(`Deployer: ${deployer_addr}`);
  console.log('Verifying contract...');
  await new Promise((resolve) => setTimeout(resolve, 30000));

  await hre.run("verify:verify", {
    address: hotpot_impl.target,
    constructorArguments: [
      LINK[network.config.chainId],
      VRFV2Wrapper[network.config.chainId]
    ],
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});