const { ethers } = require('ethers');
const { getEip712Domain } = require('./getEip712Domain');
const { listingTypes } = require('./EIP712_types');

async function mintAndListNewItem(
  lister, marketplace, nft_collection, price
) {
  await nft_collection.mint(lister);
  const token_id = await nft_collection.lastTokenId();
  await nft_collection.connect(lister).approve(marketplace.target, token_id);

  const order_data = {
    offerer: await lister.getAddress(),
	  offerItem: {
      offerToken: nft_collection.target,
      offerTokenId: token_id,
      offerAmount: ethers.utils.parseEther("1.0"), // replace with an actual price of listing
      endTime: 10n, // should be a BigInt. It's a UNIX timestamp of the offer expiration. Will be validated agains block.timestamp on-chain
	  }, 
	royalty: {
		royaltyPercent: 50, // 0.5% if the collection has ERC2981 royalties. 0 if not.
		royaltyRecipient: '0x7c0A7669F89aCe28474Efd7537f85180CAc0ef4E', // fetch from collection (ERC2981). Empty string if there is no ERC2981
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