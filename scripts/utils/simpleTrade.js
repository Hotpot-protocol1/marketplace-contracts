const { getTradeAmountFromPrice } = require('./getTradeAmountFromPrice');
const { generateOrderParameters } = require('./generateOrderParameters');

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
  buyer = buyer || user2;
  const trade_amount = getTradeAmountFromPrice(price);
  const [
    order_parameters, 
    order_hash, 
    order_data
  ] = await generateOrderParameters(
    marketplace, 
    nft_collection,
    price,
    buyer_pending_amount,
    offerer_pending_amount,
    offerer,
    buyer,
    end_time,
    salt
  );

  const trade = marketplace.connect(buyer).fulfillOrder(order_parameters, {
    value: trade_amount
  });
  return [trade, order_hash, order_data, order_parameters];
}

module.exports = {
  simpleTrade
}