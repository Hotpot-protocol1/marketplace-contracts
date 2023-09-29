const { ethers } = require('hardhat');

const INITIAL_POT_FEE = 1000; // 10%
const TRADE_FEE = 1000; // 10%
const HUNDRED_PERCENT = 10000;
const INITIAL_TICKET_COST = ethers.parseEther("0.2");
const INITIAL_NUMBER_OF_WINNERS = 11;
const INITIAL_POT_LIMIT = ethers.parseEther("100.0");
const LINK_MAINNET = "0x514910771AF9Ca656af840dff83E8264EcF986CA";
const INITIAL_CLAIM_WINDOW = 24 * 60 * 60; // one day
const LINK_FUNDING = ethers.parseUnits("5000", 18);
const ROYALTY_PERCENT = 50; // 0.5%
const ROYALTY_RECIPIENT_ID = 3;
const ERC721_trade_type = 0;
const ERC1155_trade_type = 1;

module.exports = {
  INITIAL_POT_FEE,
  TRADE_FEE,
  HUNDRED_PERCENT,
  INITIAL_TICKET_COST,
  INITIAL_NUMBER_OF_WINNERS,
  INITIAL_POT_LIMIT,
  LINK_MAINNET,
  INITIAL_CLAIM_WINDOW,
  LINK_FUNDING,
  ROYALTY_PERCENT,
  ROYALTY_RECIPIENT_ID,
  ERC721_trade_type,
  ERC1155_trade_type
}