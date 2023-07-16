const { ethers } = require('hardhat');


async function impersonateAccount(address) {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address],
  });

  return await ethers.getSigner(address);
}

async function stopImpersonating(address) {
  await hre.network.provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: [address],
  })
}

module.exports = {
  impersonateAccount,
  stopImpersonating
}