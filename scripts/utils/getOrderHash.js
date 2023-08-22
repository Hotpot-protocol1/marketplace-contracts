const { listingTypes } = require('./EIP712_types');
const { getEip712Domain } = require('./getEip712Domain');
const { ethers } = require('hardhat');

/* 
  Returns the EIP712 hash of the order data
 */
function getOrderHash(order_data, marketplace_address) {
  const domain = getEip712Domain(marketplace_address);
  return ethers.TypedDataEncoder.hash(
    domain, listingTypes, order_data
  );
}

module.exports = {
  getOrderHash
}