const { ethers } = require('hardhat');
const {
  INITIAL_POT_FEE,
  TRADE_FEE,
  HUNDRED_PERCENT,
  INITIAL_TICKET_COST,
  INITIAL_NUMBER_OF_WINNERS,
  INITIAL_POT_LIMIT,
  ROYALTY_PERCENT,
  ERC721_trade_type
} = require("./parameters.js");
const { mintAndSignNewItem } = require('./mintAndSignNewItem.js');
const { getOrderHash } = require('./getOrderHash.js');
const { signPendingAmounts } = require('./signPendingAmounts.js');
const { getOrderParameters } = require('./getOrderParameters.js');


async function tradeToFillThePot(
  marketplace, 
  nft_collection, 
  token_type
) {
  const [owner, user1, user2] = await ethers.getSigners();
  const buffer = ethers.parseEther("10.0");
  const trade_fee_needed = (INITIAL_POT_LIMIT + buffer) * BigInt(HUNDRED_PERCENT) / 
    BigInt(HUNDRED_PERCENT - INITIAL_POT_FEE); 
  const trade_amount = trade_fee_needed 
    * BigInt(HUNDRED_PERCENT) 
    / BigInt(TRADE_FEE);
  const royalty_amount = trade_amount * BigInt(ROYALTY_PERCENT) / BigInt(HUNDRED_PERCENT);
  const price = trade_amount - royalty_amount - trade_fee_needed;
  token_type = token_type !== undefined ? token_type : ERC721_trade_type;
  const receiver = await user1.getAddress();

  /* 
    Sign the order
   */
  const end_time = 3692620407n;
  const [signature, order_data] = await mintAndSignNewItem(
    user2, 
    marketplace, 
    nft_collection, 
    price,
    end_time,
    token_type
  );

  const orderHash = getOrderHash(order_data, marketplace.target);
  const [pa_signature, pending_amount_data] = await signPendingAmounts(
    marketplace,
    owner, // operator
    0,
    0,
    orderHash
  );
  const orderParameters = getOrderParameters(
    order_data, 
    pending_amount_data,
    signature,
    pa_signature,
    token_type,
    receiver
  );

  // trade
  return marketplace.connect(user1).fulfillOrder(orderParameters, {
    value: trade_amount
  });
}

module.exports = {
  tradeToFillThePot
}