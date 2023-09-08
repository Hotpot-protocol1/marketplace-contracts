const { TRADE_FEE, HUNDRED_PERCENT, INITIAL_POT_FEE } = require('./parameters');

function getPotDeltaFromTradeAmount(trade_amount) {
  const trade_fee = trade_amount * BigInt(TRADE_FEE) / BigInt(HUNDRED_PERCENT);
  return trade_fee * BigInt(HUNDRED_PERCENT - INITIAL_POT_FEE) / BigInt(HUNDRED_PERCENT);
}

module.exports = {
  getPotDeltaFromTradeAmount
}