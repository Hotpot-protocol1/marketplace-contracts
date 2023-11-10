function getOrderParameters(
  order_data, 
  order_signature,
  token_type,
  receiver
) {
  return {
    offerer: order_data.offerer, // replace with signer address
    receiver: receiver,
	  offerItem: order_data.offerItem, 
    royalty: order_data.royalty,
    salt: order_data.salt,
    orderSignature: order_signature,
    tokenType: token_type
  }
}

module.exports = {
  getOrderParameters
}