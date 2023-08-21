const { ethers } = require('ethers');
const { getEip712Domain } = require('./getEip712Domain');
const { listingTypes } = require('./EIP712_types');
const { ROYALTY_PERCENT, ROYALTY_RECIPIENT } = require('./parameters');

async function mintAndListNewItem(
  lister, 
  marketplace, 
  nft_collection, 
  price,
  end_time
) {
  await nft_collection.mint(lister);
  const token_id = await nft_collection.lastTokenId();
  await nft_collection.connect(lister).approve(marketplace.target, token_id);

  const order_data = {
    offerer: await lister.getAddress(),
	  offerItem: {
      offerToken: nft_collection.target,
      offerTokenId: token_id,
      offerAmount: price,
      endTime: end_time, 
	  }, 
    royalty: {
      royaltyPercent: ROYALTY_PERCENT, 
      royaltyRecipient: ROYALTY_RECIPIENT,
    },
    salt: 1000n,
  };
  const signature = lister.signTypedData(
    getEip712Domain(marketplace.target),
    listingTypes,

  );

  return [ lister, marketplace, nft_collection ]
}

module.exports = {
  mintAndListNewItem
}