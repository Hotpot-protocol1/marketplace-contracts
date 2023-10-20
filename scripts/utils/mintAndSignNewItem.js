const { ethers } = require('ethers');
const { getEip712Domain } = require('./getEip712Domain');
const { listingTypes } = require('./EIP712_types');
const { ROYALTY_PERCENT, ROYALTY_RECIPIENT_ID, ERC721_trade_type, ERC1155_trade_type } = require('./parameters');
const { generateSalt } = require('./generateSalt');

async function mintAndSignNewItem(
  lister, 
  marketplace, 
  nft_collection, 
  price,
  end_time,
  salt,
  token_type,
  token_amount
) {
  token_type = token_type !== undefined ? token_type : ERC721_trade_type;
  token_amount = token_amount || 1;

  if (token_type == ERC721_trade_type) {
    await nft_collection.mint(lister);
  }
  else if(token_type == ERC1155_trade_type) {
    await nft_collection.mint(lister, token_amount);
  }
  const token_id = await nft_collection.lastTokenId();

  // Approve
  if (token_type == ERC721_trade_type) {
    await nft_collection.connect(lister).approve(marketplace.target, token_id);
  }
  else if (token_type == ERC1155_trade_type) {
    await nft_collection.connect(lister).setApprovalForAll(
      marketplace.target, true
    );
  }

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
      amount: token_amount
	  }, 
    royalty: {
      royaltyPercent: ROYALTY_PERCENT, 
      royaltyRecipient: await royalty_recipient.getAddress(),
    },
    salt: salt,
  };
  const signature = await lister.signTypedData(
    getEip712Domain(marketplace.target),
    listingTypes,
    order_data
  );

  return [ signature, order_data ];
}

module.exports = {
  mintAndSignNewItem
}