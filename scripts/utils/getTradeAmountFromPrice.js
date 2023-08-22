const {
  TRADE_FEE,
  HUNDRED_PERCENT,
  ROYALTY_PERCENT
} = require("./parameters.js");

function getTradeAmountFromPrice(price) {
  const royalty_amount = price * BigInt(ROYALTY_PERCENT) / BigInt(HUNDRED_PERCENT); 
  const trade_fee_amount = price * BigInt(TRADE_FEE) / BigInt(HUNDRED_PERCENT);
  return price + royalty_amount + trade_fee_amount;
}

module.exports = {
  getTradeAmountFromPrice
}