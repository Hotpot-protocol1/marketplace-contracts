async function mintAndListNewItem(
  lister, marketplace, nft_collection, price
) {
  await nft_collection.mint(lister);
  const token_id = await nft_collection.lastTokenId();
  await nft_collection.connect(lister).approve(marketplace.target, token_id);
  await marketplace.connect(lister).makeItem(
    nft_collection.target, 
    token_id, 
    price
  );

  return [ lister, marketplace, nft_collection ]
}

module.exports = {
  mintAndListNewItem
}