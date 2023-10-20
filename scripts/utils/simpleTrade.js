const { getTradeAmountFromPrice } = require('./getTradeAmountFromPrice');
const { generateOrderParameters } = require('./generateOrderParameters');
const { ERC721_trade_type } = require('./parameters');

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
  salt,
  token_type,
  receiver,
  token_amount
) {
  const [owner, user1, user2] = await ethers.getSigners();
  buyer = buyer || user2;
  token_amount = token_amount || 1;
  token_type = token_type !== undefined ? token_type : ERC721_trade_type;
  receiver = receiver ? receiver : await buyer.getAddress();
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
    salt,
    token_type,
    receiver,
    token_amount
  );

  const trade = marketplace.connect(buyer).fulfillOrder(order_parameters, {
    value: trade_amount
  });
  return [trade, order_hash, order_data, order_parameters];
}

module.exports = {
  simpleTrade
}