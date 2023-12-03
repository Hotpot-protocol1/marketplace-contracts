const {
    loadFixture,
    mine,
    time,
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect, use } = require("chai");
const { deployHotpotImplementation } = require('../scripts/deploy/HotpotImplementation');
const { ethers } = require('hardhat');
const { dealLINKToAddress } = require("../scripts/utils/dealLINKToAddress.js");
const {
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
  ERC1155_trade_type,
  ERC721_trade_type
} = require("../scripts/utils/parameters.js");
const { tradeToFillThePot } = require("../scripts/utils/tradeToFillThePot.js");
const { deployMarketplace } = require('../scripts/deploy/Marketplace');
const { mintAndSignNewItem } = require('../scripts/utils/mintAndSignNewItem');
const { getTradeAmountFromPrice } = require('../scripts/utils/getTradeAmountFromPrice');
const { getOrderHash } = require('../scripts/utils/getOrderHash.js');
const { getOrderParameters } = require('../scripts/utils/getOrderParameters');
const { simpleTrade } = require('../scripts/utils/simpleTrade');
const { generateSalt } = require('../scripts/utils/generateSalt');
const { generateOrderParameters } = require('../scripts/utils/generateOrderParameters');
const { calculateTicketsForTrade } = require('../scripts/utils/calculateTicketsForTrade');
const { getPotDeltaFromPrice, getPotDeltaFromTradeAmount } = require('../scripts/utils/getPotDeltaFromTradeAmount');
const { AddressZero } = require('@ethersproject/constants');
const { getRandomFloat } = require('../scripts/utils/utils.js');
require("dotenv").config();


describe("Hotpot", function () {
  async function deployEverythingFixture() {
    const [owner, otherAccount] = await ethers.getSigners();
    const {
      hotpot_impl, V3Aggregator, VRFCoordinator, VRFV2Wrapper
    } = await deployHotpotImplementation();
    /* 
    Deploying the Hotpot Factory and Marketplace contracts
     */
    const factory = await ethers.deployContract("HotpotFactory", [hotpot_impl.target]);
    await factory.waitForDeployment();

    const beacon_address = await factory.beacon();
    const beacon = await ethers.getContractAt("UpgradeableBeacon", 
      beacon_address.toString());
    const operator_address = await owner.getAddress();
    const marketplace = await deployMarketplace(operator_address);

    /*
      Deploying the first Hotpot 
    */
    const init_params = {
      potLimit: ethers.parseEther("100.0"),
      raffleTicketCost: INITIAL_TICKET_COST,
      claimWindow: INITIAL_CLAIM_WINDOW, // just one day for testing
      numberOfWinners: INITIAL_NUMBER_OF_WINNERS,
      fee: INITIAL_POT_FEE,
      tradeFee: TRADE_FEE,
      marketplace: marketplace.target,
      operator: operator_address
    }

    await factory.connect(owner).deployHotpot(init_params);
    const hotpot_address = await factory.hotpots(0);
    const hotpot = await ethers.getContractAt("Hotpot", hotpot_address);
    // Configuring Marketplace
    await marketplace.setRaffleAddress(hotpot_address);

    // Configure gas limit
    const callback_gas_limit = 200000;
    await hotpot.connect(owner).setChainlinkGasLimit(callback_gas_limit);

    /*
      Funding the Hotpot with LINK 
     */
    await dealLINKToAddress(hotpot.target, LINK_FUNDING); // 5k LINK should be enough

    return { factory, hotpot_impl, owner, otherAccount, beacon, marketplace,
    hotpot, V3Aggregator, VRFCoordinator, VRFV2Wrapper };
  }

  async function deployCollectionsFixture() {
    const nft_collection = await ethers.deployContract("ERC721Mock");
    await nft_collection.waitForDeployment();

    const erc1155_collection = await ethers.deployContract("ERC1155Mock");
    await erc1155_collection.waitForDeployment();
    return {nft_collection, erc1155_collection};
  }

  async function deployEverythingAndFillPotFixture() {
    const { 
      factory, hotpot_impl, owner, 
      otherAccount, marketplace, hotpot, 
      V3Aggregator, VRFCoordinator, VRFV2Wrapper
    } = await loadFixture(
      deployEverythingFixture
    );
    const { nft_collection } = await loadFixture(deployCollectionsFixture);

    await tradeToFillThePot(marketplace, nft_collection, ERC721_trade_type);

    return {
      factory, hotpot_impl, owner, 
      otherAccount, marketplace, hotpot,
      V3Aggregator, VRFCoordinator, VRFV2Wrapper, nft_collection
    }
  }

  async function deployBoostedCollections() {
    const nft_boosted1 = await ethers.deployContract("BoostedERC721Mock");
    await nft_boosted1.waitForDeployment();

    const nft_boosted2 = await ethers.deployContract("BoostedERC721Mock");
    await nft_boosted2.waitForDeployment();
    return {nft_boosted1, nft_boosted2};
  }

  it("should deploy factory", async function () {
    const { 
      factory, hotpot_impl, owner,
      otherAccount, beacon
    } = await loadFixture(
        deployEverythingFixture
    );
    // Factory owner is set up correctly
    expect(await factory.owner()).to.equal(await owner.getAddress());
    // The beacon implementation is correct
    expect(await beacon.implementation()).to.equal(hotpot_impl.target);
  });

  it("should deploy and initialize a Hotpot", async function() {
    const { 
      factory, hotpot_impl, owner, 
      otherAccount, marketplace, hotpot
    } = await loadFixture(
      deployEverythingFixture
    );
    
    const hotpot_owner = await hotpot.connect(otherAccount).owner();
    const owner_address = await owner.getAddress();
    // Factory owner is the hotpot owner
    expect(hotpot_owner).to.equal(owner_address);

    // Second initialize is impossible
    const init_params = {
      potLimit: ethers.parseEther("100.0"),
      raffleTicketCost: INITIAL_TICKET_COST,
      claimWindow: 24 * 60 * 60, // just one day for testing
      numberOfWinners: INITIAL_NUMBER_OF_WINNERS,
      fee: INITIAL_POT_FEE,
      tradeFee: TRADE_FEE,
      marketplace: marketplace.target,
      operator: otherAccount
    }
    await expect(hotpot.initialize(owner_address, init_params)).to.be.revertedWith("Initializable: contract is already initialized");
  });

  it("should execute a trade", async function() {
    let { 
      factory, hotpot_impl, owner, 
      otherAccount, marketplace, hotpot
    } = await loadFixture(
      deployEverythingFixture
    );
    let { nft_collection } = await loadFixture(deployCollectionsFixture);
    let [, user1, user2] = await ethers.getSigners();
    const buyer = await user1.getAddress();
    const seller = await user2.getAddress();

    /* 
      Trade
     */
    const buyer_pending_amount_before = await hotpot.pendingAmounts(buyer);
    const offerer_pending_amount_before = await hotpot.pendingAmounts(seller);
    const end_time = 3692620410; // just some remote point in the future
    const price = ethers.parseEther("1.0");
    const trade_amount = getTradeAmountFromPrice(price);
    const [trade, orderHash] = await simpleTrade(
      marketplace, 
      nft_collection,
      price,
      user2,
      user1,
      end_time
    );
    /* 
      Check the generated tickets and new pending amounts
     */
    const expected_buyer_tickets = 5;
    const expected_seller_tickets = 5;
    const buyer_id_start = 2;
    const buyer_id_end = 7; //buyer_id_start + expected_buyer_tickets - 1;
    const seller_id_start = 8;// buyer_id_end + 1;
    const seller_id_end = 13; // seller_id_start + expected_seller_tickets - 1;
    const token_id = 1;

    expect(trade).to.emit(hotpot, "GenerateRaffleTickets").withArgs(
      seller,
      buyer,
      buyer_id_start,
      buyer_id_end,
      seller_id_start,
      seller_id_end,
      buyer_pending_amount_before,
      offerer_pending_amount_before
    );
    expect(trade).to.emit(marketplace, "OrderFulfilled").withArgs(
      seller,
      buyer,
      nft_collection.target,
      token_id,
      trade_amount,
      orderHash
    );
    await trade;

    /* 
      Check the currentPotSize and the balance of the Pot
     */
    // 1% of trade_amount
    const expected_trade_fee = trade_amount * BigInt(TRADE_FEE) / BigInt(HUNDRED_PERCENT);
    const pot_balance = await ethers.provider.getBalance(hotpot.target);
    expect(pot_balance).to.equal(expected_trade_fee, "Incorrect pot balance");
    // 90% of trade_fee
    const expected_pot_size = expected_trade_fee * 
      BigInt(HUNDRED_PERCENT - INITIAL_POT_FEE) / BigInt(HUNDRED_PERCENT);
    expect(await hotpot.currentPotSize()).to.equal(expected_pot_size, "Unexpected pot size");

    /* 
      Check access control
     */
    expect(hotpot.connect(otherAccount).executeTrade([trade_amount, buyer, seller]))
      .to.be.revertedWith("Caller is not the marketplace contract");

    // Check the last raffle ticket id
    let lastTicketId = await hotpot.lastRaffleTicketId();
    expect(lastTicketId).to.equal(
      1 + expected_buyer_tickets + expected_seller_tickets,
       "Last raffle ticket id is not updated"
    );

    // Check order status
    const order_status = await marketplace.orderStatus(orderHash);
    expect(order_status.isFulfilled).to.equal(true, "Order status is not updated");

    // Check pending amounts
    const expected_p_a = trade_amount % BigInt(INITIAL_TICKET_COST);
    const buyer_p_a_after = await hotpot.pendingAmounts(buyer);
    const offerer_p_a_after = await hotpot.pendingAmounts(seller);
    expect(buyer_p_a_after).to.equal(expected_p_a, "Pending amount mismatch");
    expect(offerer_p_a_after).to.equal(expected_p_a, "Pending amount mismatch");

    console.log("Pot balance and currentPotSize: ", 
      ethers.formatEther(pot_balance), ethers.formatEther(expected_pot_size));
    console.log("Last ticket id: ", Number(lastTicketId));
  });

  it("Trade with zero address receiver", async function() {
    let { 
      factory, hotpot_impl, owner, 
      otherAccount, marketplace, hotpot
    } = await loadFixture(
      deployEverythingFixture
    );
    let { erc1155_collection } = await loadFixture(deployCollectionsFixture);
    let [, user1, user2] = await ethers.getSigners();
    const buyer = await user1.getAddress();
    const seller = await user2.getAddress();

    /* 
      Trade
     */
    const end_time = 3692620410; // just some remote point in the future
    const price = ethers.parseEther("1.05");
    const trade_amount = getTradeAmountFromPrice(price);
    const salt = 69n;
    const token_amount = 3;
    const collection_type = 1;
    
    const [trade, orderHash] = await simpleTrade(
      marketplace, 
      erc1155_collection,
      price,
      user2,
      user1,
      end_time,
      salt,
      collection_type,
      AddressZero,
      token_amount
    );

    expect(trade).to.changeEtherBalances(
      [buyer, seller], 
      [-price, price]
    );

    await trade;

    /* 
      Check token owner
     */
    const token_id = 1;
    const token_bal = await erc1155_collection.balanceOf(buyer, token_id);
    expect(token_bal).to.equal(token_amount, "Incorrect nft receiver");

    // Pending amount
    const expected_pending_amount = trade_amount % BigInt(INITIAL_TICKET_COST);
    expect(await hotpot.pendingAmounts(buyer)).to.equal(
      expected_pending_amount, "Unexpected pending amount"
    );
  });

  it("ERC1155 trade with a specified receiver", async function() {
    let { 
      factory, hotpot_impl, owner, 
      otherAccount, marketplace, hotpot
    } = await loadFixture(
      deployEverythingFixture
    );
    let { erc1155_collection } = await loadFixture(deployCollectionsFixture);
    let [, user1, user2, user3] = await ethers.getSigners();
    const buyer = await user1.getAddress();
    const seller = await user2.getAddress();
    const receiver = await user3.getAddress();

    /* 
      Trade
     */
    const end_time = 3692620410; // just some remote point in the future
    const price = ethers.parseEther("1.5");
    const trade_amount = getTradeAmountFromPrice(price);
    const salt = 10000n;
    const token_amount = 6;
    const [trade, orderHash] = await simpleTrade(
      marketplace, 
      erc1155_collection,
      price,
      user2,
      user1,
      end_time,
      salt,
      ERC1155_trade_type,
      receiver,
      token_amount
    );

    /* 
      Validate order event
     */
    const token_id = 1;
    expect(trade).to.emit(marketplace, "OrderFulfilled").withArgs(
      seller,
      receiver,
      erc1155_collection.target,
      token_id,
      token_amount,
      trade_amount,
      orderHash
    );
    await trade;

    /* 
      Check the currentPotSize and the balance of the Pot
     */
    // 1% of trade_amount
    const expected_trade_fee = trade_amount * BigInt(TRADE_FEE) / BigInt(HUNDRED_PERCENT);
    const pot_balance = await ethers.provider.getBalance(hotpot.target);
    expect(pot_balance).to.equal(expected_trade_fee, "Incorrect pot balance");
    // 90% of trade_fee
    const expected_pot_size = expected_trade_fee * 
      BigInt(HUNDRED_PERCENT - INITIAL_POT_FEE) / BigInt(HUNDRED_PERCENT);
    expect(await hotpot.currentPotSize()).to.equal(expected_pot_size, "Unexpected pot size");

    // Check order status
    const order_status = await marketplace.orderStatus(orderHash);
    expect(order_status.isFulfilled).to.equal(true, "Order status is not updated");

    // Check token holder
    const bal = await erc1155_collection.balanceOf(receiver, token_id);
    expect(bal).to.equal(token_amount, "Wrong nft receiver");
  });

  it('ERC1155 fulfill order', async function() {
    let { 
      factory, hotpot_impl, owner, 
      otherAccount, marketplace, hotpot
    } = await loadFixture(
      deployEverythingFixture
    );
    let { erc1155_collection } = await loadFixture(deployCollectionsFixture);
    let [, user1, user2] = await ethers.getSigners();

    /* 
      Trade
     */
    const end_time = 3692620410; // just some remote point in the future
    const price = ethers.parseEther("0.8");
    const token_type = ERC1155_trade_type;
    const token_amount = 2;
    const [trade, orderHash] = await simpleTrade(
      marketplace, 
      erc1155_collection,
      price,
      user2,
      user1,
      end_time,
      undefined,
      token_type,
      undefined,
      token_amount
    );

    await trade;

    // Check token holder
    const buyer = await user1.getAddress();
    const token_id = 1;
    const tokens = await erc1155_collection.balanceOf(buyer, token_id);
    expect(tokens).to.equal(token_amount, "Token is not transferred to buyer");
    // Check order status
    const order_status = await marketplace.orderStatus(orderHash);
    expect(order_status.isFulfilled).to.equal(true, "Order status is not updated");
  });
  
  it("Two trades should correctly generate tickets and set a range", async function() {
    let { 
      factory, hotpot_impl, owner, 
      otherAccount, marketplace, hotpot
    } = await loadFixture(
      deployEverythingFixture
    );
    let { nft_collection } = await loadFixture(deployCollectionsFixture);

    /*
      Trade #1
      ___________________________________ 
     */
    let [, user1, user2] = await ethers.getSigners();
    //let buyer_pending_amount = ethers.parseEther("0.1");
    //let seller_pending_amount = ethers.parseEther("0.05");
    const buyer = await user1.getAddress();
    const seller = await user2.getAddress();

    // Ensure the pot limit and ticket cost before trading
    const trade_fee = await hotpot.tradeFee();
    expect(trade_fee).to.equal(TRADE_FEE, "Incorrect trade FEE");
    const pot_limit = await hotpot.potLimit();
    expect(pot_limit).to.equal(ethers.parseEther("100.0"), "Pot limit is incorrect");
    const raffle_ticket_cost = await hotpot.raffleTicketCost();
    expect(raffle_ticket_cost).to.equal(INITIAL_TICKET_COST, "Ticket cost is incorrectly set");
    // As it is the first trade
    expect(await hotpot.currentPotSize()).to.equal(0, "Current pot size is non-zero");
    // Check the Pot fee
    expect(await hotpot.fee()).to.equal(INITIAL_POT_FEE, "Pot fee is incorrect");
    expect(await hotpot.lastRaffleTicketId()).to.equal(1, "Initial last ticket id is incorrect");

    /* 
      First Trade
     */
    const price1 = ethers.parseEther("480.17");
    const price2 = ethers.parseEther("670.03"); // for overflow
    const trade_amount1 = getTradeAmountFromPrice(price1);
    const trade_amount2 = getTradeAmountFromPrice(price2);
    
    const [trade] = await simpleTrade(
      marketplace,
      nft_collection,
      price1
    );

    let expected_pending_amount = trade_amount1 % BigInt(INITIAL_TICKET_COST);
    let expected_buyer_tickets = trade_amount1 / BigInt(INITIAL_TICKET_COST);
    let expected_seller_tickets = expected_buyer_tickets;
    let buyer_id_start = 2;
    let buyer_id_end = buyer_id_start + Number(expected_buyer_tickets) - 1;
    let seller_id_start = buyer_id_end + 1;
    let seller_id_end = seller_id_start + Number(expected_seller_tickets) - 1;
    expect(trade).to.emit(hotpot, "GenerateRaffleTickets").withArgs(
      buyer,
      seller,
      buyer_id_start,
      buyer_id_end,
      seller_id_start,
      seller_id_end,
      expected_pending_amount,
      expected_pending_amount
    );
    await trade;

    // Check the last raffle ticket id
    let lastTicketId = await hotpot.lastRaffleTicketId();
    const trade_1_last_ticket_id = lastTicketId;
    expect(lastTicketId).to.equal(BigInt(seller_id_end), "Last raffle ticket id is incorrect");

    /* 
      Check the currentPotSize and the balance of the Pot
     */
    // 1% of trade_amount
    const expected_trade_fee = trade_amount1 * BigInt(TRADE_FEE) / BigInt(HUNDRED_PERCENT); 
    // 90% of trade_fee
    const expected_pot_size = expected_trade_fee * 
      BigInt(HUNDRED_PERCENT - INITIAL_POT_FEE) / BigInt(HUNDRED_PERCENT); // should be around 45ETH
    const pot_balance = await ethers.provider.getBalance(hotpot.target);
    expect(pot_balance).to.equal(expected_trade_fee, "Pot balance is incorrect after trade 1");
    const currentPotSize1 = await hotpot.currentPotSize();
    expect(currentPotSize1).to.equal(expected_pot_size, "Pot size is incorrect after Trade 1");
    
    // Checking pending amounts
    expect(await hotpot.pendingAmounts(buyer)).to.equal(
      expected_pending_amount, "Buyer pending amount mismatch"
    );
    expect(await hotpot.pendingAmounts(seller)).to.equal(
      expected_pending_amount, "Seller pending amount mismatch"
    );

    /*
      Trade #2
      ___________________________________ 
     */

    const token_id_2 = 2;
    const [trade2, order_2_hash] = await simpleTrade(
      marketplace,
      nft_collection,
      price2
    );

    expected_pending_amount = (expected_pending_amount + trade_amount2) %
      BigInt(INITIAL_TICKET_COST);
    expected_buyer_tickets = Number((trade_amount2 + expected_pending_amount) / 
      BigInt(INITIAL_TICKET_COST));
    expected_seller_tickets = expected_buyer_tickets;
    buyer_id_start = Number(lastTicketId) + 1;
    buyer_id_end = buyer_id_start + expected_buyer_tickets - 1;
    seller_id_start = buyer_id_end + 1;
    seller_id_end = seller_id_start + expected_seller_tickets - 1;

    expect(trade2).to.emit(hotpot, "GenerateRaffleTickets").withArgs(
      buyer,
      seller,
      buyer_id_start,
      buyer_id_end,
      seller_id_start,
      seller_id_end,
      expected_pending_amount,
      expected_pending_amount
    );
    expect(trade2).to.emit(marketplace, "OrderFulfilled").withArgs(
      seller,
      buyer,
      nft_collection.target,
      token_id_2,
      trade_amount2,
      order_2_hash
    );
    await trade2;

    /*
      Check the last ticket id
     */
    lastTicketId = await hotpot.lastRaffleTicketId();
    expect(lastTicketId).to.equal(seller_id_end, "Last raffle ticket id is not updated");

    /* 
      Check the currentPotSize and the balance of the Pot
     */
    // 1% of trade_amount
    const expected_trade2_fee = trade_amount2 * BigInt(TRADE_FEE) / BigInt(HUNDRED_PERCENT);
    // 90% of trade_fee
    const trade_2_pot_delta = expected_trade2_fee * 
      BigInt(HUNDRED_PERCENT - INITIAL_POT_FEE) / BigInt(HUNDRED_PERCENT);
    // The difference goes to the next pot
    const expected_pot_size2 = (expected_pot_size + trade_2_pot_delta) % pot_limit;

    expect(await hotpot.currentPotSize()).to.equal(
      expected_pot_size2, "Pot size is incorrect after Trade 2"
    );

    const pot_balance2 = await ethers.provider.getBalance(hotpot.target);
    expect(pot_balance2).to.equal(
      pot_balance + expected_trade2_fee, "Pot balance is incorrect after trade 2"
    );
    console.log("Trade#2 Pot balance and currentPotSize: ", 
      ethers.formatEther(pot_balance2), ethers.formatEther(expected_pot_size2));
    console.log("Trade#2 Last ticket id: ", Number(lastTicketId));

    /*
      Check the ticket range
     */
    const eth_to_fill_pot = (pot_limit - expected_pot_size) * BigInt(HUNDRED_PERCENT)
      / BigInt(HUNDRED_PERCENT - INITIAL_POT_FEE);
    const traded_eth_to_fill_pot = eth_to_fill_pot * BigInt(HUNDRED_PERCENT) / BigInt(TRADE_FEE);
    const expected_tickets_trade_2 = traded_eth_to_fill_pot / BigInt(INITIAL_TICKET_COST) * 2n;
    const expected_ticket_end = expected_tickets_trade_2 + trade_1_last_ticket_id; 
    const current_pot_ticket_end = await hotpot.potTicketIdEnd();
    expect(current_pot_ticket_end).to.equal(expected_ticket_end, "Incorrect pot ticket end id");
    expect(await hotpot.nextPotTicketIdStart()).to.equal(expected_ticket_end + 1n, "Id of the next pot starting ticket is incorrect");

    // Check pending amounts
    expect(await hotpot.pendingAmounts(buyer)).to.equal(
      expected_pending_amount, "Buyer pending amount mismatch"
    );
    expect(await hotpot.pendingAmounts(seller)).to.equal(
      expected_pending_amount, "Seller pending amount mismatch"
    );
  });

  it("Should request Chainlink randomness when the pot is filled", async function() {
    const { 
      factory, hotpot_impl, owner, 
      otherAccount, marketplace, hotpot
    } = await loadFixture(
      deployEverythingFixture
    );
    const { nft_collection } = await loadFixture(deployCollectionsFixture);

    const trade = tradeToFillThePot(marketplace, nft_collection, ERC721_trade_type);
    /*
      Check the event and request data
     */
    await trade;
    const request_id = await hotpot.lastRequestId();
    let request_created;
    expect(request_id).to.not.equal(0, "Last request id is not set");
    expect(await hotpot.requestIds(0)).to.equal(request_id, "Request ids array is not updated");
    [, request_created, ] = await hotpot.chainlinkRequests(request_id);
    expect(request_created).to.equal(true, "Request status is not set to true");

  });

  it("Should receive Chainlink random word and derive n more", async function() {
    const { 
      factory, hotpot_impl, owner, otherAccount, beacon, marketplace,
      hotpot, V3Aggregator, VRFCoordinator, VRFV2Wrapper
    } = await loadFixture(
      deployEverythingAndFillPotFixture
    );
    
    /* 
    The Pot is filled, so the random word is already requested
     */
    const request_id = await hotpot.lastRequestId();
    let fulfilled_;
    let exists_;
    let fulfilled_after;

    expect(request_id).to.not.equal(0, "Last request id is not set");
    expect(await hotpot.requestIds(0)).to.equal(request_id, "Request ids array is not updated");
    [fulfilled_, exists_, ] = await hotpot.chainlinkRequests(request_id);
    expect(fulfilled_).to.equal(false, "The request should not be fulfilled before waiting");
    expect(exists_).to.equal(true, "Request should exist");

    // Manually fulfill the request
    await VRFCoordinator.fulfillRandomWords(request_id, VRFV2Wrapper.target);
    [fulfilled_after,,] = await hotpot.chainlinkRequests(request_id);
    // Ensure the request is fulfilled    
    expect(fulfilled_after).to.equal(true, "The request should be already fulfilled");

    /*
      Check that the winning ids are set, unique and within range
     */
    const current_pot_id = await hotpot.currentPotId();
    const winning_ids = await hotpot.getWinningTicketIds(Number(current_pot_id - 1n));
    expect(winning_ids.length).to.equal(
      await hotpot.numberOfWinners(), "Incorrect number winning ids");
    console.log("Winners:", winning_ids);
  });

  it('Receive Chainlink random word for 1 winner', async function() {
    const { 
      factory, hotpot_impl, owner, otherAccount, beacon, marketplace,
      hotpot, V3Aggregator, VRFCoordinator, VRFV2Wrapper
    } = await loadFixture(
      deployEverythingFixture
    );
    const { nft_collection } = await deployCollectionsFixture();

    // Only one winner
    const pot_limit = await hotpot.potLimit();
    await hotpot.connect(owner).updateNumberOfWinners(1);
    await hotpot.updatePrizeAmounts([pot_limit]);

    await tradeToFillThePot(marketplace, nft_collection);
    
    /* 
    The Pot is filled, so the random word is already requested
     */
    const request_id = await hotpot.lastRequestId();
    let fulfilled_;
    let exists_;
    let fulfilled_after;

    expect(request_id).to.not.equal(0, "Last request id is not set");
    expect(await hotpot.requestIds(0)).to.equal(request_id, "Request ids array is not updated");
    [fulfilled_, exists_, ] = await hotpot.chainlinkRequests(request_id);
    expect(fulfilled_).to.equal(false, "The request should not be fulfilled before waiting");
    expect(exists_).to.equal(true, "Request should exist");

    // Manually fulfill the request
    await VRFCoordinator.fulfillRandomWords(request_id, VRFV2Wrapper.target);
    [fulfilled_after,,] = await hotpot.chainlinkRequests(request_id);
    // Ensure the request is fulfilled    
    expect(fulfilled_after).to.equal(true, "The request should be already fulfilled");
  });

  it("Should execute raffle", async function() {
    const { 
      factory, hotpot_impl, owner, 
      otherAccount, marketplace, hotpot
    } = await loadFixture(
      deployEverythingAndFillPotFixture
    );

    const [, user1, user2, user3, user4, user5] = await ethers.getSigners();
    const winners = new Array(INITIAL_NUMBER_OF_WINNERS);
    const user_1_address = await user1.getAddress();
    const user_2_address = await user2.getAddress();
    winners.fill(await user3.getAddress());
    winners[0] = user_1_address;
    winners[INITIAL_NUMBER_OF_WINNERS - 1] = user_2_address;
    const amounts = new Array(INITIAL_NUMBER_OF_WINNERS);
    const mini_winning = ethers.parseEther("5.0");
    const big_winning = ethers.parseEther("50.0");
    amounts.fill(mini_winning);
    amounts[0] = big_winning;

    // Set raffle prizes on-chain
    await hotpot.connect(owner).updatePrizeAmounts(amounts);
    
    /* 
      Execute raffle and check winners Prizes 
    */
    expect(hotpot.connect(otherAccount).executeRaffle(winners))
      .to.be.revertedWith("Caller must be the operator");
    await hotpot.connect(owner).executeRaffle(winners);
    const [user1_claimable_amount, user1_deadline] = await hotpot.claimablePrizes(user_1_address);
    const [user2_claimable_amount, user2_deadline] = await hotpot.claimablePrizes(user_2_address);
    expect(user1_claimable_amount).to.equal(
      big_winning, "Incorrect User 1 claimable amount"
    );
    expect(user2_claimable_amount).to.equal(
      mini_winning, "Incorrect User 2 claimable amount"
    );
  });

  it("Users should claim the winnings", async function() {
    const { 
      factory, hotpot_impl, owner, 
      otherAccount, marketplace, hotpot
    } = await loadFixture(
      deployEverythingAndFillPotFixture
    );

    const [, user1, user2, user3, user4, user5] = await ethers.getSigners();
    const winners = new Array(INITIAL_NUMBER_OF_WINNERS);
    const user_1_address = await user1.getAddress();
    const user_2_address = await user2.getAddress();
    const user_3_address = await user3.getAddress();
    winners.fill(await user3.getAddress());
    winners[0] = user_1_address;
    winners[INITIAL_NUMBER_OF_WINNERS - 1] = user_2_address;
    winners[INITIAL_NUMBER_OF_WINNERS - 2] = user_3_address;
    const amounts = new Array(INITIAL_NUMBER_OF_WINNERS);
    const mini_winning = ethers.parseEther("5.0");
    const big_winning = ethers.parseEther("50.0");
    amounts.fill(mini_winning);
    amounts[0] = big_winning;
    // Setting prize
    await hotpot.connect(owner).updatePrizeAmounts(amounts);
    await hotpot.executeRaffle(winners);

    /* 
      Claiming the winnings
    */
    expect(hotpot.connect(user4).claim()).to.be.revertedWith(
      "No available winnings"
    );
    expect(hotpot.connect(user1).claim()).to.changeEtherBalances(
      [hotpot.target, await user1.getAddress()],
      [-big_winning, big_winning]
    );
    expect(hotpot.connect(user2).claim()).to.changeEtherBalances(
      [hotpot.target, await user2.getAddress()],
      [-mini_winning, mini_winning]
    );
    expect(hotpot.connect(user1).claim()).to.be.revertedWith(
      "No available winnings"
    );
    expect(hotpot.connect(user2).claim()).to.be.revertedWith(
      "No available winnings"
    );
    
    /* 
      Check claiming after deadline
     */
    const blocks_interval = Math.floor(INITIAL_CLAIM_WINDOW / 13) + 500; 
    await mine(blocks_interval);
    expect(hotpot.connect(user3).claim()).to.be.revertedWith(
      "Claim window is closed"
    );
  });

  it("Second pot is successfully filled after trades", async function() {
    const { 
      factory, hotpot_impl, owner, otherAccount, beacon, marketplace,
      hotpot, V3Aggregator, VRFCoordinator, VRFV2Wrapper, nft_collection
    } = await loadFixture(
      deployEverythingAndFillPotFixture
    );

    /*
      Check LINK balance
     */
    const LinkToken = await ethers.getContractAt("ERC20", LINK_MAINNET);
    const hotpot_link_balance = await LinkToken.balanceOf(hotpot.target);
    const link_spent = LINK_FUNDING - hotpot_link_balance;

    console.log("LINK spent on VRF fullfillment: ", 
      ethers.formatEther(link_spent.toString())
    );

    // Set a new raffle ticket cost
    const new_ticket_cost = ethers.parseEther("0.1");
    await hotpot.setRaffleTicketCost(new_ticket_cost);
    expect(await hotpot.raffleTicketCost()).to.equal(
      new_ticket_cost, "Raffle ticket cost is not updated"
    );

    /* 
      Intermediate trade
    */
    const [, user1, user2] = await ethers.getSigners();
    const ticket_id_start = Number(await hotpot.nextPotTicketIdStart());
    const trade_amount = ethers.parseEther("3.2");
    const price = trade_amount / BigInt(HUNDRED_PERCENT + TRADE_FEE);
    const buyer = await user1.getAddress();
    const seller = await user2.getAddress();

    /* 
      Trade
     */
    const [trade] = await simpleTrade(
      marketplace,
      nft_collection,
      price,
      user2,
      user1
    );
    
    /* 
      Check the generated tickets and new pending amounts
     */
    const expected_buyer_tickets = 33;
    const expected_seller_tickets = 32;
    const buyer_id_start = ticket_id_start;
    const buyer_id_end = ticket_id_start + expected_buyer_tickets - 1;
    const seller_id_start = buyer_id_end + 1;
    const seller_id_end = buyer_id_end + expected_seller_tickets - 1;

    expect(trade).to.emit(hotpot, "GenerateRaffleTickets").withArgs(
      buyer,
      seller,
      buyer_id_start,
      buyer_id_end,
      seller_id_start,
      seller_id_end,
      0,
      0
    );
    await trade;

    /*
      Fill up the current pot and check winners
     */
    await tradeToFillThePot(marketplace, nft_collection);
    const request_id = await hotpot.lastRequestId();
    let fulfilled_;
    let exists_;
    let fulfilled_after;
    expect(request_id).to.not.equal(0, "Last request id is not set");

    expect(await hotpot.requestIds(1)).to.equal(request_id, "Request ids array is not updated");
    [fulfilled_, exists_, ] = await hotpot.chainlinkRequests(request_id);
    expect(fulfilled_).to.equal(false, "The request should not be fulfilled before waiting");
    expect(exists_).to.equal(true, "Request should exist");

    //  Manually fulfill the request
    await VRFCoordinator.fulfillRandomWords(request_id, VRFV2Wrapper.target);
    [fulfilled_after,,] = await hotpot.chainlinkRequests(request_id);
    // Ensure the request is fulfilled
    expect(fulfilled_after).to.equal(true, "The request should be already fulfilled");

    /*
      Check that the winning ids are set, unique and within range
     */
    const current_pot_id = await hotpot.currentPotId();
    const ticket_id_from = await hotpot.potTicketIdStart();
    expect(ticket_id_from).to.equal(ticket_id_start, "Incorrect range start");
    const ticket_id_to = await hotpot.potTicketIdEnd();
    const winning_ids = await hotpot.getWinningTicketIds(Number(current_pot_id - 1n));
    expect(winning_ids.length).to.equal(
      await hotpot.numberOfWinners(), "Incorrect number winning ids");
    console.log(
      `Winners: (from #${ticket_id_from} to #${ticket_id_to})`,
       winning_ids
    );
  });

  it('Cannot fulfill after order cancelled', async function() {
    let { 
      factory, hotpot_impl, owner, 
      otherAccount, marketplace, hotpot
    } = await loadFixture(
      deployEverythingFixture
    );
    let { nft_collection } = await loadFixture(deployCollectionsFixture);
    const [, user1, user2] = await ethers.getSigners();
    const price = ethers.parseEther("4.0");
    const trade_amount = getTradeAmountFromPrice(price);

    /* 
      Offerer cannot be buyer
     */
    const [trade, order_hash, order_data, order_parameters] = await simpleTrade(
      marketplace,
      nft_collection,
      price,
      user1,
      user1
    );
    expect(trade).to.be.revertedWith("Signer cannot fulfill their own order");

    /* 
      Cancel order
     */
    const cancelling = marketplace.connect(user1).cancelOrder(order_data);
    const offerer = await user1.getAddress();
    expect(cancelling).to.emit(marketplace, "OrderCancelled").withArgs(
      offerer,
      nft_collection.target,
      order_data.offerItem.offerTokenId,
      order_hash
    );
    await cancelling;

    const trade2 = marketplace.connect(user2).fulfillOrder(order_parameters, {
      value: trade_amount
    });
    expect(trade2).to.be.revertedWith("Order is cancelled and cannot be fulfilled");
  });

  it('Cannot fulfill order twice', async function() {
    let { 
      marketplace
    } = await loadFixture(
      deployEverythingFixture
    );
    let { nft_collection } = await loadFixture(deployCollectionsFixture);
    const [, offerer, buyer, user3] = await ethers.getSigners();
    const price = ethers.parseEther("0.02");
    const trade_amount = getTradeAmountFromPrice(price);

    /* 
      Fulfill
    */
    const [trade, , order_data, order_parameters] = await simpleTrade(
      marketplace,
      nft_collection,
      price,
      offerer,
      buyer
    );
    await trade;

    /* 
      Fulfilling the same order twice
     */
    const trade2 = marketplace.connect(user3).fulfillOrder(order_parameters, {
      value: trade_amount
    });
    expect(trade2).to.be.revertedWith("Order is already fulfilled");
  });

  it('Cannot fulfill after order expired', async function() {
    let { 
      factory, hotpot_impl, owner, 
      otherAccount, marketplace, hotpot
    } = await loadFixture(
      deployEverythingFixture
    );
    let { nft_collection } = await loadFixture(deployCollectionsFixture);
    const [, user1, user2] = await ethers.getSigners();
    const price = ethers.parseEther("4.0");
    const trade_amount = getTradeAmountFromPrice(price);
    /* 
      Calculate end time
     */
    const blockNumBefore = await ethers.provider.getBlockNumber();
    const blockBefore = await ethers.provider.getBlock(blockNumBefore);
    const timestampBefore = blockBefore.timestamp;
    const end_time = timestampBefore + 300; // 300 seconds into the future
    
    const [signature, order_data] = await mintAndSignNewItem(
      user1, marketplace, nft_collection, price, end_time
    );
    const order_parameters = getOrderParameters(
      order_data, 
      signature
    );

    /* 
      Mine until order expired
     */
    const blocks = Math.floor(300 / 13) + 10;
    await mine(blocks);

    const trade = marketplace.connect(user2).fulfillOrder(order_parameters, {
      value: trade_amount
    });
    expect(trade).to.be.revertedWith("Offer has expired");
  });

  it('Royalty is successfully payed out', async function() {
    let { 
      factory, hotpot_impl, owner, 
      otherAccount, marketplace, hotpot
    } = await loadFixture(
      deployEverythingFixture
    );
    let { nft_collection } = await loadFixture(deployCollectionsFixture);
    const [, user1, user2] = await ethers.getSigners();
    const signers = await ethers.getSigners();
    const royalty_recipient = await signers[ROYALTY_RECIPIENT_ID].getAddress();
    const price = ethers.parseEther("4.0");
    const trade_amount = getTradeAmountFromPrice(price);
    const royalty_amount = price * BigInt(ROYALTY_PERCENT) / BigInt(HUNDRED_PERCENT);
    const raffle_fee = trade_amount - royalty_amount - price;
    const lister = await user1.getAddress();
    const buyer = await user2.getAddress();

    const [trade] = await simpleTrade(
      marketplace,
      nft_collection,
      price,
      0,
      0
    );
    expect(trade).to.changeEtherBalance(
      [royalty_recipient, buyer, lister, hotpot.target],
      [royalty_amount, -trade_amount, price, raffle_fee]
    );

    await trade;
  });

  it('Buyer cannot modify order data', async function() {
    let { 
      marketplace
    } = await loadFixture(
      deployEverythingFixture
    );
    let { nft_collection } = await loadFixture(deployCollectionsFixture);
    const [operator, buyer, offerer, user3] = await ethers.getSigners();
    const price = ethers.parseEther("4.0");
    const end_time = 3692620410;
    const trade_amount = getTradeAmountFromPrice(price);

    const [signature, order_data] = await mintAndSignNewItem(
      offerer,
      marketplace,
      nft_collection,
      price,
      end_time
    );
    const order_hash = getOrderHash(order_data, marketplace.target);
    const order_parameters = getOrderParameters(
      order_data,
      signature
    );
    
    /* 
      Replaced token id
     */
    const params1 = {
      ...order_parameters,
      offerItem: {
        ...order_parameters.offerItem,
        offerTokenId: 100
      }
    };
    const trade = marketplace.connect(buyer).fulfillOrder(params1, {
      value: trade_amount
    });
    expect(trade).to.be.reverted;
    
    /* 
      Replaced price
     */
    const params2 = {
      ...order_parameters,
      offerItem: {
        ...order_parameters.offerItem,
        offerAmount: ethers.parseEther("0.0002")
      }
    };
    const trade2 = marketplace.connect(buyer).fulfillOrder(params2, {
      value: trade_amount
    });
    expect(trade2).to.be.reverted;

    /* 
      Replace royalties
     */
    const new_recipient = await user3.getAddress();
    const params3 = {
      ...order_parameters,
      royalty: {
        ...order_parameters.royalty,
        royaltyRecipient: new_recipient
      }
    };
    const trade3 = marketplace.connect(buyer).fulfillOrder(params3, {
      value: trade_amount
    });
    expect(trade3).to.be.reverted;
  });

  it('Batch fulfill order', async function() {
    let { 
      marketplace, hotpot
    } = await loadFixture(
      deployEverythingFixture
    );
    let { nft_collection } = await loadFixture(deployCollectionsFixture);

    /* 
    
      ORDER 1

     */

    const [operator, buyer, offerer1, offerer2, offerer3] = await ethers.getSigners();
    const price1 = ethers.parseEther("4.0");
    const trade_amount_1 = getTradeAmountFromPrice(price1);
    const [params_1, order_1_hash] = await generateOrderParameters(
      marketplace,
      nft_collection,
      price1,
      offerer1,
      buyer
    );

    /* 

        CREATING ORDER 2

    */
    const price2 = ethers.parseEther("3.1");
    const trade_amount_2 = getTradeAmountFromPrice(price2);
    const [params_2, order_2_hash] = await generateOrderParameters(
      marketplace,
      nft_collection,
      price2,
      offerer2,
      buyer
    );
    
    /* 

        CREATING ORDER 3
        
    */
    const price3 = ethers.parseEther("0.01");
    const trade_amount_3 = getTradeAmountFromPrice(price3);
    const [params_3, order_3_hash] = await generateOrderParameters(
      marketplace,
      nft_collection,
      price3,
      offerer3,
      buyer
    );

    /* 

       Prepare parameters and fulfill
     */

    const trade_amount_total = trade_amount_1 + trade_amount_2 + trade_amount_3;
    const batch_fulfill_order_params = [params_1, params_2, params_3];
    const batch = marketplace.connect(buyer).batchFulfillOrder(
      batch_fulfill_order_params, {
        value: trade_amount_total
      }
    );

    /* 

      CHECKING MARKETPLACE EVENTS AFTER FULFILLMENT
    
    */
    const offerer1_address = await offerer1.getAddress();  
    const offerer2_address = await offerer2.getAddress();  
    const offerer3_address = await offerer3.getAddress();  
    const buyer_address = await buyer.getAddress();
    expect(batch).to.emit(marketplace, "OrderFulfilled").withArgs(
      offerer1_address,
      buyer_address,
      params_1.offerItem.offerToken,
      params_1.offerItem.offerTokenId,
      trade_amount_1,
      order_1_hash
    );
    expect(batch).to.emit(marketplace, "OrderFulfilled").withArgs(
      offerer2_address,
      buyer_address,
      params_2.offerItem.offerToken,
      params_2.offerItem.offerTokenId,
      trade_amount_2,
      order_2_hash
    );
    expect(batch).to.emit(marketplace, "OrderFulfilled").withArgs(
      offerer3_address,
      buyer_address,
      params_3.offerItem.offerToken,
      params_3.offerItem.offerTokenId,
      trade_amount_3,
      order_3_hash
    );

    /* 
    
      CHECKING HOTPOT EVENTS

     */
    const expected_p_a_post_trade_1 = trade_amount_1 % BigInt(INITIAL_TICKET_COST);
    const expected_p_a_post_trade_2 = expected_p_a_post_trade_1 + 
      trade_amount_2 % BigInt(INITIAL_TICKET_COST);
    const expected_p_a_post_trade_3 = (trade_amount_1 + trade_amount_2 + 
      trade_amount_3) % BigInt(INITIAL_TICKET_COST);
    const tickets_1 = calculateTicketsForTrade(
      trade_amount_1,
      1,
      expected_p_a_post_trade_1,
      expected_p_a_post_trade_1
    );
    const tickets_2 = calculateTicketsForTrade(
      trade_amount_2,
      tickets_1.seller_ticket_end,
      expected_p_a_post_trade_2,
      expected_p_a_post_trade_2
    );
    const tickets_3 = calculateTicketsForTrade(
      trade_amount_3,
      tickets_2.seller_ticket_end,
      expected_p_a_post_trade_3,
      expected_p_a_post_trade_3
    );
    expect(batch).to.emit(hotpot, "GenerateRaffleTickets").withArgs(
      buyer_address, 
			offerer1_address, 
			tickets_1.buyer_ticket_start, 
			tickets_1.buyer_ticket_end,
      tickets_1.seller_ticket_start,
      tickets_1.seller_ticket_end,
			expected_p_a_post_trade_1,
			expected_p_a_post_trade_1
    );
    expect(batch).to.emit(hotpot, "GenerateRaffleTickets").withArgs(
      buyer_address, 
			offerer2_address, 
			tickets_2.buyer_ticket_start, 
			tickets_2.buyer_ticket_end,
      tickets_2.seller_ticket_start,
      tickets_2.seller_ticket_end,
			expected_p_a_post_trade_2,
			expected_p_a_post_trade_2
    );
    expect(batch).to.emit(hotpot, "GenerateRaffleTickets").withArgs(
      buyer_address, 
			offerer3_address, 
			tickets_3.buyer_ticket_start, 
			tickets_3.buyer_ticket_end,
      tickets_3.seller_ticket_start,
      tickets_3.seller_ticket_end,
			expected_p_a_post_trade_3,
			expected_p_a_post_trade_3
    );
    await batch;

  });

  it('Batch fulfill order with receiver', async function() {
    let { 
      marketplace, hotpot
    } = await loadFixture(
      deployEverythingFixture
    );
    let { nft_collection, erc1155_collection } = await loadFixture(deployCollectionsFixture);

    /* 
    
      ORDER 1

     */

    const [
      operator, 
      buyer, 
      offerer1, 
      offerer2, 
      receiver
    ] = await ethers.getSigners();
    const price1 = ethers.parseEther("4.0");
    const receiver_addr = await receiver.getAddress();
    const trade_amount_1 = getTradeAmountFromPrice(price1);
    const salt = 10000;
    const [params_1, order_1_hash] = await generateOrderParameters(
      marketplace,
      nft_collection,
      price1,
      offerer1,
      buyer,
      0,
      salt,
      ERC721_trade_type,
      receiver_addr
    );

    /* 

        CREATING ORDER 2

    */
    const price2 = ethers.parseEther("0.3");
    const trade_amount_2 = getTradeAmountFromPrice(price2);
    const [params_2, order_2_hash] = await generateOrderParameters(
      marketplace,
      erc1155_collection,
      price2,
      offerer2,
      buyer,
      0,
      salt,
      ERC1155_trade_type,
      receiver_addr
    );

    /* 

      TRADE 3 (different receiver)

     */

    const price3 = ethers.parseEther("0.8");
    const trade_amount_3 = getTradeAmountFromPrice(price3);
    const [params_3, order_3_hash] = await generateOrderParameters(
      marketplace,
      erc1155_collection,
      price3,
      offerer2,
      buyer,
      0,
      salt,
      ERC1155_trade_type,
      AddressZero
    );

    /* 

       Prepare parameters and fulfill
     */

    const total_trade_amount = trade_amount_1 + trade_amount_2 + trade_amount_3;
    const batch_fulfill_order_params = [params_1, params_2, params_3];

    await marketplace.connect(buyer).batchFulfillOrder(
      batch_fulfill_order_params, {
        value: total_trade_amount
      }
    );
  
    // Check out token holders
    const buyer_addr = await buyer.getAddress();
    const erc721_bal = await nft_collection.balanceOf(receiver_addr);
    const erc1155_bal = await erc1155_collection.balanceOf(receiver_addr, 1);
    const erc1155_bal_receiver_2 = await erc1155_collection.balanceOf(
      buyer_addr, 2
    );

    expect(erc721_bal).to.equal(1, "Wrong nft receiver");
    expect(erc1155_bal).to.equal(1, "Wrong nft receiver");
    expect(erc1155_bal_receiver_2).to.equal(1, "Wrong nft receiver 2");

    // Check pending amounts
    const expected_p_a_offerer_1 = trade_amount_1 % BigInt(INITIAL_TICKET_COST);
    const expected_p_a_receiver_1 = (trade_amount_1 + trade_amount_2) % 
      BigInt(INITIAL_TICKET_COST);
    const expected_p_a_offerer_2 = 
      (trade_amount_2 + trade_amount_3) % BigInt(INITIAL_TICKET_COST);
    const expected_p_a_receiver_2 = trade_amount_3 % BigInt(INITIAL_TICKET_COST);
    const offerer_1_addr = await offerer1.getAddress();
    const offerer_2_addr = await offerer2.getAddress();
    expect(await hotpot.pendingAmounts(offerer_1_addr)).to.equal(
      expected_p_a_offerer_1, 
      "Unexpected pending amount offerer 1"
    );
    expect(await hotpot.pendingAmounts(offerer_2_addr)).to.equal(
      expected_p_a_offerer_2, 
      "Unexpected pending amount offerer 2"
    );
    expect(await hotpot.pendingAmounts(receiver_addr)).to.equal(
      expected_p_a_receiver_1, 
      "Unexpected pending amount receiver 1"
    );
    expect(await hotpot.pendingAmounts(buyer_addr)).to.equal(
      expected_p_a_receiver_2, 
      "Unexpected pending amount receiver 2"
    );
  });

  it('Batch fulfill order (single seller)', async function() {
    let { 
      marketplace, hotpot
    } = await loadFixture(
      deployEverythingFixture
    );
    let { nft_collection } = await loadFixture(deployCollectionsFixture);

    /* 
    
      ORDER 1

     */

    const [operator, buyer, offerer, receiver1, receiver2, receiver3] = await ethers.getSigners();
    const price1 = ethers.parseEther("0.8");
    const trade_amount_1 = getTradeAmountFromPrice(price1);
    const [params_1, order_1_hash] = await generateOrderParameters(
      marketplace,
      nft_collection,
      price1,
      offerer,
      receiver1
    );

    /* 

        CREATING ORDER 2

    */
    const price2 = ethers.parseEther("3.100005");
    const trade_amount_2 = getTradeAmountFromPrice(price2);
    const [params_2, order_2_hash] = await generateOrderParameters(
      marketplace,
      nft_collection,
      price2,
      offerer,
      receiver2
    );
    
    /* 

        CREATING ORDER 3
        
    */
    const price3 = ethers.parseEther("0.01");
    const trade_amount_3 = getTradeAmountFromPrice(price3);
    const [params_3, order_3_hash] = await generateOrderParameters(
      marketplace,
      nft_collection,
      price3,
      offerer,
      receiver3
    );

    /* 

       Prepare parameters and fulfill
     */

    const total_trade_amount = trade_amount_1 + trade_amount_2 + trade_amount_3;
    const offerer_address = await offerer.getAddress();
    const batch_fulfill_order_params = [params_1, params_2, params_3];

    const batch = marketplace.connect(buyer).batchFulfillOrder(
      batch_fulfill_order_params, {
        value: total_trade_amount
      }
    );

    /* 

      CHECKING MARKETPLACE EVENTS AFTER FULFILLMENT
    
    */
    const buyer_address = await buyer.getAddress();
    const receiver1_addr = await receiver1.getAddress();
    const receiver2_addr = await receiver2.getAddress();
    const receiver3_addr = await receiver3.getAddress();
    expect(batch).to.emit(marketplace, "OrderFulfilled").withArgs(
      offerer_address,
      receiver1_addr,
      params_1.offerItem.offerToken,
      params_1.offerItem.offerTokenId,
      trade_amount_1,
      order_1_hash
    );
    expect(batch).to.emit(marketplace, "OrderFulfilled").withArgs(
      offerer_address,
      receiver2_addr,
      params_2.offerItem.offerToken,
      params_2.offerItem.offerTokenId,
      trade_amount_2,
      order_2_hash
    );
    expect(batch).to.emit(marketplace, "OrderFulfilled").withArgs(
      offerer_address,
      receiver2_addr,
      params_3.offerItem.offerToken,
      params_3.offerItem.offerTokenId,
      trade_amount_3,
      order_3_hash
    );

    /* 
    
      CHECKING HOTPOT EVENTS

      */
    const tickets_1 = calculateTicketsForTrade(
      trade_amount_1,
      1,
      0n,
      0n
    );

    const receiver1_pa_post_trade1 = (trade_amount_1) % INITIAL_TICKET_COST;
    const offerer_pa_post_trade1 = receiver1_pa_post_trade1;

    const tickets_2 = calculateTicketsForTrade(
      trade_amount_2,
      tickets_1.seller_ticket_end,
      receiver1_pa_post_trade1,
      offerer_pa_post_trade1
    );

    const receiver2_pa_post_trade2 = 
      (trade_amount_2) % INITIAL_TICKET_COST;
    const offerer_pa_post_trade2 = 
      (offerer_pa_post_trade1 + trade_amount_2) % INITIAL_TICKET_COST;    

    const tickets_3 = calculateTicketsForTrade(
      trade_amount_3,
      tickets_2.seller_ticket_end,
      receiver2_pa_post_trade2,
      offerer_pa_post_trade2
    );

    const receiver3_pa_post_trade3 = 
      (trade_amount_3) % INITIAL_TICKET_COST;
    const offerer_pa_post_trade3 = 
      (total_trade_amount) % INITIAL_TICKET_COST;

    expect(batch).to.emit(hotpot, "GenerateRaffleTickets").withArgs(
      buyer_address, 
      offerer_address, 
      tickets_1.buyer_ticket_start, 
      tickets_1.buyer_ticket_end,
      tickets_1.seller_ticket_start,
      tickets_1.seller_ticket_end,
      receiver1_pa_post_trade1,
      offerer_pa_post_trade1
    );
    expect(batch).to.emit(hotpot, "GenerateRaffleTickets").withArgs(
      buyer_address, 
      offerer_address, 
      tickets_2.buyer_ticket_start, 
      tickets_2.buyer_ticket_end,
      tickets_2.seller_ticket_start,
      tickets_2.seller_ticket_end,
      receiver2_pa_post_trade2,
      offerer_pa_post_trade2
    );
    expect(batch).to.emit(hotpot, "GenerateRaffleTickets").withArgs(
      buyer_address, 
      offerer_address, 
      tickets_3.buyer_ticket_start, 
      tickets_3.buyer_ticket_end,
      tickets_3.seller_ticket_start,
      tickets_3.seller_ticket_end,
      receiver3_pa_post_trade3,
      offerer_pa_post_trade3
    );
    
    /* 
      
      CHECK THE STATE CHANGE
    
    */
    const trade_fee_total = total_trade_amount * BigInt(TRADE_FEE) 
      / BigInt(HUNDRED_PERCENT);
    const price_total = price1 + price2 + price3;
    expect(batch).to.changeEtherBalances([
      hotpot.target, offerer_address, buyer_address
    ], [
      trade_fee_total, price_total, -total_trade_amount
    ]);

    await batch;

    const pot_size = await hotpot.currentPotSize();
    const scale = 10n ** 10n;
    const expected_pot_size = trade_fee_total * 
      (BigInt(HUNDRED_PERCENT) - BigInt(INITIAL_POT_FEE)) / 
      BigInt(HUNDRED_PERCENT);
    expect(pot_size / scale).to.equal(
      expected_pot_size / scale, "Incorrect pot size");

    /* 
      CHECK PENDING AMOUNTS
     */
    expect(await hotpot.pendingAmounts(receiver1_addr)).to.equal(
      receiver1_pa_post_trade1, "Receiver 1 unexpected pending amount"
    );
    expect(await hotpot.pendingAmounts(receiver2_addr)).to.equal(
      receiver2_pa_post_trade2, "Receiver 2 unexpected pending amount"
    );
    expect(await hotpot.pendingAmounts(receiver3_addr)).to.equal(
      receiver3_pa_post_trade3, "Receiver 3 unexpected pending amount"
    );
    expect(await hotpot.pendingAmounts(offerer_address)).to.equal(
      offerer_pa_post_trade3, "Offerer unexpected pending amount"
    );
  });

  it('Misconfigured or malicious batches should revert', async function() {
    let { 
      marketplace, hotpot
    } = await loadFixture(
      deployEverythingFixture
    );
    let { nft_collection } = await loadFixture(deployCollectionsFixture);

    /* 
    
      ORDER 1

     */

    const [operator, buyer, offerer1, offerer2] = await ethers.getSigners();
    const price1 = ethers.parseEther("4.0");
    const trade_amount_1 = getTradeAmountFromPrice(price1);
    const [params_1, order_1_hash] = await generateOrderParameters(
      marketplace,
      nft_collection,
      price1,
      offerer1,
      buyer
    );

    /* 

        CREATING ORDER 2

    */
    const price2 = ethers.parseEther("3.0");
    const trade_amount_2 = getTradeAmountFromPrice(price2);
    const [params_2, order_2_hash] = await generateOrderParameters(
      marketplace,
      nft_collection,
      price2,
      offerer2,
      buyer
    );

    const batch_fulfill_order_params = [params_1, params_2];
    const total_trade_amount = trade_amount_1 + trade_amount_2;
    
    /* 

      FULFILLING WITH BAD PARAMETERS
    
    */

    // Duplicate orders
    const batch_4_fulfill_order_params = [params_1, params_2, params_1];
    const batch4 = marketplace.connect(buyer).batchFulfillOrder(
      batch_4_fulfill_order_params,
      {
        value: total_trade_amount + trade_amount_1
      }
    );
    expect(batch4).to.be.revertedWith("Order is already fulfilled");

    const batch5 = marketplace.connect(buyer).batchFulfillOrder(
      batch_fulfill_order_params,
      {
        value: total_trade_amount - 1n // insufficient ether
      }
    );
    expect(batch5).to.be.revertedWith("Insufficient ether provided");
  });

  it('Trading with ticket discounts', async function() {
    // TODO make a trade, check the pending amounts and the last ticket id

    const { 
      marketplace, hotpot
    } = await loadFixture(deployEverythingFixture);
    const { nft_boosted1, nft_boosted2 } = await loadFixture(deployBoostedCollections);
    const [owner, alice, bob, jon_bones_jones] = await ethers.getSigners();
    const buyer_1 = await bob.getAddress();
    const buyer_2 = await jon_bones_jones.getAddress();
    const offerer = await alice.getAddress();
    
    /* 
      Setting discounted ticket prices
     */
    const discounted_ticket_price_1 = ethers.parseEther(getRandomFloat(0.05, 0.2).toFixed(5));
    const discounted_ticket_price_2 = ethers.parseEther(getRandomFloat(0.05, 0.2).toFixed(5));
    await hotpot.setDiscountedTicketCost(nft_boosted1.target, discounted_ticket_price_1);
    await hotpot.setDiscountedTicketCost(nft_boosted2.target, discounted_ticket_price_2);

    await nft_boosted1.mint(offerer);
    await nft_boosted2.mint(buyer_1);

    // ensure discounts are set
    expect(await hotpot.boostedCollections(0)).to.equal(nft_boosted1.target, 
      "Boosted collection is not set"
    );
    expect(await hotpot.ticketCostPerCollection(nft_boosted1.target)).to.equal(
      discounted_ticket_price_1,
      "Discounted price is not set"
    );
    expect(await nft_boosted1.balanceOf(offerer)).to.equal(1, "Nft not minted");
    const ticket_cost_for_buyer1 = await hotpot.getTicketCostForUser(buyer_1);
    expect(ticket_cost_for_buyer1).to.equal(discounted_ticket_price_2, 
      "Incorrect ticket price calculations"
    );
  });

  // TODO batch fulfill order triggers the pot. Ticket ranges are correct

  // TODO: pause and check that actions are unavailable. only owner can pause
  // TODO: calculate coverage
  // TODO: add a test case for upgrading the implementation
});

