const hre = require('hardhat');
require('dotenv').config();

function getEip712Domain(marketplace_address) {
  return {
    name: process.env.PROTOCOL_NAME,
    version: process.env.PROTOCOL_VERSION,
    chainId: hre.network.config.chainId,
    verifyingContract: marketplace_address
  }
}

module.exports = {
  getEip712Domain
}