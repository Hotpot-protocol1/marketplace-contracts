const { ethers } = require('hardhat');
const {
  INITIAL_POT_FEE,
  TRADE_FEE,
  HUNDRED_PERCENT,
  INITIAL_TICKET_COST,
  INITIAL_NUMBER_OF_WINNERS,
  INITIAL_POT_LIMIT,
  ROYALTY_PERCENT
} = require("./parameters.js");
const { mintAndListNewItem } = require('./mintAndListNewItem.js');


async function tradeToFillThePot(marketplace, nft_collection, item_id) {
  const [owner, user1, user2] = await ethers.getSigners();
  const trade_fee_needed = INITIAL_POT_LIMIT * BigInt(HUNDRED_PERCENT) / 
    BigInt(HUNDRED_PERCENT - INITIAL_POT_FEE); 
  const price = trade_fee_needed 
    * BigInt(HUNDRED_PERCENT) 
    / BigInt(TRADE_FEE); 
  const royalty_amount = price * BigInt(ROYALTY_PERCENT) / BigInt(HUNDRED_PERCENT);
  const trade_amount = price + trade_fee_needed + royalty_amount;

  await mintAndListNewItem(user2, marketplace, nft_collection, price);
  return marketplace.connect(user1).purchaseItem(item_id, {
    value: trade_amount + ethers.parseEther("10.0") // add 10ETH just for safety
  });
}

module.exports = {
  tradeToFillThePot
}