const { ethers, network } = require('hardhat');

async function dealLINKToAddress(
  address,
  amount
) {
  const LINK_MAINNET = "0x514910771AF9Ca656af840dff83E8264EcF986CA";
  const link_token = await ethers.getContractAt(
      "ERC20",
      LINK_MAINNET
  );
  const LINK_WHALE_ADDRESS = "0xF977814e90dA44bFA03b6295A0616a897441aceC";
  const LINK_DECIMALS = 18;

  await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [LINK_WHALE_ADDRESS],
  });
  const link_whale = await ethers.getSigner(LINK_WHALE_ADDRESS);

  await link_token
      .connect(link_whale)
      .transfer(
          address,
          amount
      );
}

module.exports = {
  dealLINKToAddress
}
