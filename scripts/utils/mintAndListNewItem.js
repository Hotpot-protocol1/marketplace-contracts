const { ethers } = require('ethers');
const { getEip712Domain } = require('./getEip712Domain');
const { listingTypes } = require('./EIP712_types');
const { ROYALTY_PERCENT, ROYALTY_RECIPIENT_ID } = require('./parameters');

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
  const salt = BigInt(Math.floor(Math.random() * 10000));
  const signers = await hre.ethers.getSigners();
  const royalty_recipient = signers[ROYALTY_RECIPIENT_ID];

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
      royaltyRecipient: await royalty_recipient.getAddress(),
    },
    salt: salt,
  };
  const signature = lister.signTypedData(
    getEip712Domain(marketplace.target),
    listingTypes,
    order_data
  );

  return [ signature, order_data ];
}

module.exports = {
  mintAndListNewItem
}