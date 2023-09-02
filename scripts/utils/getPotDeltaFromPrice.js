const { TRADE_FEE, HUNDRED_PERCENT, INITIAL_POT_FEE } = require('./parameters');

function getPotDeltaFromPrice(price) {
  const trade_fee = price * BigInt(TRADE_FEE) / BigInt(HUNDRED_PERCENT);
  return trade_fee * BigInt(HUNDRED_PERCENT - INITIAL_POT_FEE) / BigInt(HUNDRED_PERCENT);
}

module.exports = {
  getPotDeltaFromPrice
}