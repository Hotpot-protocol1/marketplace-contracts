const { pendingAmountType } = require('./EIP712_types');
const { getEip712Domain } = require('./getEip712Domain');

async function signPendingAmounts(
  marketplace, operator,
  seller_pending_amount, buyer_pending_amount, order_hash
) {
  const pending_amount_data = {
    offererPendingAmount: seller_pending_amount,
    buyerPendingAmount: buyer_pending_amount,
    orderHash: order_hash
  };
  const signature = await operator.signTypedData(
    getEip712Domain(marketplace.target),
    pendingAmountType,
    pending_amount_data
  );

  return [signature, pending_amount_data];
}

module.exports = {
  signPendingAmounts
}