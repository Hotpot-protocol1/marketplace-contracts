function getOrderParameters(
  order_data, 
  pending_amounts, 
  order_signature,
  pending_amounts_signature,
  token_type,
  receiver
) {
  return {
    offerer: order_data.offerer, // replace with signer address
    receiver: receiver,
	  offerItem: order_data.offerItem, 
    royalty: order_data.royalty,
    pendingAmountsData: pending_amounts,
    salt: order_data.salt,
    orderSignature: order_signature,
    pendingAmountsSignature: pending_amounts_signature,
    tokenType: token_type
  }
}

module.exports = {
  getOrderParameters
}