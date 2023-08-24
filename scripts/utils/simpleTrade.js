const { ethers } = require('hardhat');
const { getOrderHash } = require('./getOrderHash');
const { signPendingAmounts } = require('./signPendingAmounts');
const { getOrderParameters } = require('./getOrderParameters');
const { mintAndSignNewItem } = require('./mintAndSignNewItem');
const { getTradeAmountFromPrice } = require('./getTradeAmountFromPrice');

/* 
  Lists a new item for a given price from user1 account (second signer)
  Fulfills the order using the user2 account (third signer)
  Returns order fulfillment transaction  
*/
async function simpleTrade(
  marketplace, 
  nft_collection,
  price,
  buyer_pending_amount,
  offerer_pending_amount,
  offerer,
  buyer,
  end_time,
  salt
) {
  const [owner, user1, user2] = await ethers.getSigners();
  offerer = offerer || user1;
  buyer = buyer || user2;
  const trade_amount = getTradeAmountFromPrice(price);
  end_time = end_time ? end_time : 3692620407;
  
  const [signature, order_data] = await mintAndSignNewItem(
    offerer, marketplace, nft_collection, price, end_time, salt
  );
  const order_hash = getOrderHash(order_data, marketplace.target);
  const [pa_signature, pending_amount_data] = await signPendingAmounts(
    marketplace,
    owner, // operator
    offerer_pending_amount,
    buyer_pending_amount,
    order_hash
  );
  const order_parameters = getOrderParameters(
    order_data, 
    pending_amount_data,
    signature,
    pa_signature
  );

  const trade = marketplace.connect(buyer).fulfillOrder(order_parameters, {
    value: trade_amount
  });
  return [trade, order_hash, order_data, order_parameters];
}

module.exports = {
  simpleTrade
}