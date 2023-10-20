const { ethers } = require('hardhat');
const { getOrderHash } = require('./getOrderHash');
const { signPendingAmounts } = require('./signPendingAmounts');
const { getOrderParameters } = require('./getOrderParameters');
const { mintAndSignNewItem } = require('./mintAndSignNewItem');
const { getTradeAmountFromPrice } = require('./getTradeAmountFromPrice');
const { ERC721_trade_type } = require('./parameters');


async function generateOrderParameters(
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
  offerer = offerer || user1;
  token_amount = token_amount || 1;
  buyer = buyer || user2;
  end_time = end_time ? end_time : 3692620407;
  token_type = token_type !== undefined ? token_type : ERC721_trade_type;
  receiver = receiver ? receiver : await buyer.getAddress();
  
  const [signature, order_data] = await mintAndSignNewItem(
    offerer, marketplace, nft_collection, price, 
    end_time, salt, token_type, token_amount
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
    pa_signature,
    token_type,
    receiver
  );

  return [order_parameters, order_hash, order_data];
}

module.exports = {
  generateOrderParameters
}