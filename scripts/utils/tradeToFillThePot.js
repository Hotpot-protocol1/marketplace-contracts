const { ethers } = require('hardhat');
const {
  INITIAL_POT_FEE,
  TRADE_FEE,
  HUNDRED_PERCENT,
  INITIAL_TICKET_COST,
  INITIAL_NUMBER_OF_WINNERS,
  INITIAL_POT_LIMIT
} = require("./parameters.js");

async function tradeToFillThePot(marketplace, hotpot) {
  const [owner, user1, user2] = await ethers.getSigners();
  const traded_amount_no_fee = INITIAL_POT_LIMIT * BigInt(HUNDRED_PERCENT) / 
    BigInt(TRADE_FEE); 
  // 110% of trade_fee
  const trade_amount = traded_amount_no_fee 
    * BigInt(HUNDRED_PERCENT) 
    / BigInt(HUNDRED_PERCENT - INITIAL_POT_FEE) + ethers.parseEther("1.0"); // add 1ETH just for safety
  const buyer = await user1.getAddress();
  const seller = await user2.getAddress();

  // Send 1000 ETH to the marketplace
  owner.sendTransaction({
    to: marketplace.target,
    value: ethers.parseEther("1000.0"),
  });

  return marketplace.trade(
    hotpot.target, 
    trade_amount,
    buyer,
    seller,
    0,
    0
  );
}

module.exports = {
  tradeToFillThePot
}