const { ethers } = require('ethers');
const { getEip712Domain } = require('./getEip712Domain');
const { listingTypes } = require('./EIP712_types');
const { ROYALTY_PERCENT, ROYALTY_RECIPIENT_ID } = require('./parameters');
const { generateSalt } = require('./generateSalt');

async function mintAndSignNewItem(
  lister, 
  marketplace, 
  nft_collection, 
  price,
  end_time,
  salt
) {
  await nft_collection.mint(lister);
  const token_id = await nft_collection.lastTokenId();
  await nft_collection.connect(lister).approve(marketplace.target, token_id);
  salt = salt || generateSalt();
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
  mintAndSignNewItem
}