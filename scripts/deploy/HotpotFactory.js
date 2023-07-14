const { deployHotpotImplementation } = require('./HotpotImplementation');

const hre = require("hardhat");

async function deployHotpotFactory() {
    const [owner] = await hre.ethers.getSigners();
    const hotpot = await deployHotpotImplementation();

    const Factory = await hre.ethers.getContractFactory("HotpotFactory");
    const factory = await Factory.deploy(hotpot.address);
    await factory.deployed();
}

module.exports = {
    deployHotpotFactory
}