const {
  TRADE_FEE,
  HUNDRED_PERCENT,
  ROYALTY_PERCENT
} = require("./parameters.js");

function getTradeAmountFromPrice(price) {
  return price * BigInt(HUNDRED_PERCENT) / (
    BigInt(HUNDRED_PERCENT) - 
    BigInt(TRADE_FEE) - 
    BigInt(ROYALTY_PERCENT)
  );
}

module.exports = {
  getTradeAmountFromPrice
}