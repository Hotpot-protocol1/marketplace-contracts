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
  LINK_FUNDING
} = require("../scripts/utils/parameters.js");
const { tradeToFillThePot } = require("../scripts/utils/tradeToFillThePot.js");
const { deployMarketplace } = require('../scripts/deploy/Marketplace');
const { mintAndListNewItem } = require('../scripts/utils/mintAndListNewItem');
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

    /*
      Funding the Hotpot with LINK 
     */
    await dealLINKToAddress(hotpot.target, LINK_FUNDING); // 5k LINK should be enough

    return { factory, hotpot_impl, owner, otherAccount, beacon, marketplace,
    hotpot, V3Aggregator, VRFCoordinator, VRFV2Wrapper};
  }

  async function deployCollectionFixture() {
    const nft_collection = await ethers.deployContract("ERC721Mock");
    await nft_collection.waitForDeployment();
    return {nft_collection};
  }

  async function deployEverythingAndFillPotFixture() {
    const { 
      factory, hotpot_impl, owner, 
      otherAccount, marketplace, hotpot, 
      V3Aggregator, VRFCoordinator, VRFV2Wrapper
    } = await loadFixture(
      deployEverythingFixture
    );
    const { nft_collection } = await loadFixture(deployCollectionFixture);

    await tradeToFillThePot(marketplace, nft_collection, 1);

    return {
      factory, hotpot_impl, owner, 
      otherAccount, marketplace, hotpot,
      V3Aggregator, VRFCoordinator, VRFV2Wrapper, nft_collection
    }
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

  it('should list an nft', async function() {
    const { 
      factory, hotpot_impl, owner, 
      otherAccount, marketplace, hotpot
    } = await loadFixture(
      deployEverythingFixture
    );
    const { nft_collection } = await loadFixture(deployCollectionFixture);

    /*
      Mint and Approve
     */
    const [, user1, user2] = await ethers.getSigners();
    await nft_collection.mint(user1);
    await nft_collection.mint(user2);
    await nft_collection.connect(user1).approve(marketplace.target, 1);
    await nft_collection.connect(user2).approve(marketplace.target, 2);
    const price1 = ethers.parseEther("1.0");
    const price2 = ethers.parseEther("2.0");

    /* 
      List
     */
    const listing1 = marketplace.connect(user1).makeItem(
      nft_collection.target, 
      1, 
      price1
    );
    const listing2 = marketplace.connect(user2).makeItem(
      nft_collection.target, 
      2, 
      price2
    );

    const item_id_1 = 1;
    const item_id_2 = 2;
    expect(listing1).to.emit(marketplace, "Offered").withArgs(
      item_id_1,
      nft_collection.target,
      1,
      price1,
      user1
    );
    await listing1;
  });

  it("should execute a trade", async function() {
    let { 
      factory, hotpot_impl, owner, 
      otherAccount, marketplace, hotpot
    } = await loadFixture(
      deployEverythingFixture
    );
    let { nft_collection } = await loadFixture(deployCollectionFixture);
    let [, user1, user2] = await ethers.getSigners();
    const buyer = await user1.getAddress();
    const seller = await user2.getAddress();

    /*
      Mint token, approve and list
     */
    const token_id = 1;
    const price = ethers.parseEther("1.0");
    const item_id = 1;
    [user2, marketplace, nft_collection] = await mintAndListNewItem(
      user2, marketplace, nft_collection, price
    );

    /* 
      Trade
     */
    const trade_fee = await hotpot.tradeFee();
    const trade_amount = price * 
      (BigInt(HUNDRED_PERCENT) + trade_fee) / BigInt(HUNDRED_PERCENT);
    const trade = marketplace.connect(user1).purchaseItem(item_id, {
      value: trade_amount
    });
    /* 
      Check the generated tickets and new pending amounts
     */
    const expected_buyer_tickets = 5;
    const expected_seller_tickets = 5;
    const buyer_id_start = 2;
    const buyer_id_end = 7; //buyer_id_start + expected_buyer_tickets - 1;
    const seller_id_start = 8;// buyer_id_end + 1;
    const seller_id_end = 13; // seller_id_start + expected_seller_tickets - 1;

    expect(trade).to.emit(hotpot, "GenerateRaffleTickets").withArgs(
      seller,
      seller,
      buyer_id_start,
      buyer_id_end,
      seller_id_start,
      seller_id_end,
      0,
      0
    );
    expect(trade).to.emit(marketplace, "Bought").withArgs(
      item_id,
      nft_collection.target,
      token_id,
      price,
      seller,
      buyer
    );
    await trade;

    /* 
      Check the currentPotSize and the balance of the Pot
     */
    // 1% of trade_amount
    const expected_trade_fee = trade_amount - price;
    const pot_balance = await ethers.provider.getBalance(hotpot.target);
    expect(pot_balance).to.equal(expected_trade_fee, "Incorrect pot balance");
    // 90% of trade_fee
    const expected_pot_size = expected_trade_fee * 
      BigInt(HUNDRED_PERCENT - INITIAL_POT_FEE) / BigInt(HUNDRED_PERCENT);
    expect(await hotpot.currentPotSize()).to.equal(expected_pot_size, "Unexpected pot size");

    /* 
      Check access control
     */
    expect(hotpot.connect(otherAccount).executeTrade([trade_amount, buyer, seller, 0, 0]))
      .to.be.revertedWith("Caller is not the marketplace contract");

    // Check the last raffle ticket id
    let lastTicketId = await hotpot.lastRaffleTicketId();
    expect(lastTicketId).to.equal(
      1 + expected_buyer_tickets + expected_seller_tickets,
       "Last raffle ticket id is not updated"
    );

    console.log("Pot balance and currentPotSize: ", 
      ethers.formatEther(pot_balance), ethers.formatEther(expected_pot_size));
    console.log("Last ticket id: ", Number(lastTicketId));
  });
  
  it("Two trades should correctly generate tickets and set a range", async function() {
    let { 
      factory, hotpot_impl, owner, 
      otherAccount, marketplace, hotpot
    } = await loadFixture(
      deployEverythingFixture
    );
    let { nft_collection } = await loadFixture(deployCollectionFixture);

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
      List items
     */
    const price1 = ethers.parseEther("480.15");
    const price2 = ethers.parseEther("670.0");
    const item_id_1 = 1;
    const item_id_2 = 2;
    const trade_amount1 = price1 * 
      (BigInt(HUNDRED_PERCENT) + trade_fee) / BigInt(HUNDRED_PERCENT);
    const trade_amount2 = price2 * 
      (BigInt(HUNDRED_PERCENT) + trade_fee) / BigInt(HUNDRED_PERCENT);
    
    [user1, marketplace, nft_collection] = await mintAndListNewItem(
      user1, marketplace, nft_collection, price1
    );
    [user1, marketplace, nft_collection] = await mintAndListNewItem(
      user1, marketplace, nft_collection, price2
    );
    // Ensure listed
    expect(await marketplace.activeItemCount()).to.equal(2, "Unexpected items count");
    const [order_1, order_2] = await marketplace.getAllListedNfts();
    expect(order_2.sold).to.equal(false, "Item should not be sold");
    expect(order_2.price).to.equal(price2, "Order 2 price is incorrectly set");
    
    /* 
      Trade
     */
    const trade = marketplace.connect(user2).purchaseItem(item_id_1, {
      value: trade_amount1
    });

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
      0,
      0
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
    const expected_trade_fee = trade_amount1 - price1; 
    // 90% of trade_fee
    const expected_pot_size = expected_trade_fee * 
      BigInt(HUNDRED_PERCENT - INITIAL_POT_FEE) / BigInt(HUNDRED_PERCENT); // should be around 45ETH
    const pot_balance = await ethers.provider.getBalance(hotpot.target);
    expect(pot_balance).to.equal(expected_trade_fee, "Pot balance is incorrect after trade 1");
    const currentPotSize1 = await hotpot.currentPotSize();
    expect(currentPotSize1).to.equal(expected_pot_size, "Pot size is incorrect after Trade 1");
    

    /*
      Trade #2
      ___________________________________ 
     */

    const trade2 = marketplace.connect(user2).purchaseItem(item_id_2, {
      value: trade_amount2
    });

    expected_buyer_tickets = Number(trade_amount2 / BigInt(INITIAL_TICKET_COST));
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
      0,
      0
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
    const expected_trade2_fee = trade_amount2 - price2;
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
    const expected_ticket_end = expected_tickets_trade_2 + trade_1_last_ticket_id + 1n; 
    const current_pot_ticket_end = await hotpot.potTicketIdEnd();
    expect(current_pot_ticket_end).to.equal(expected_ticket_end, "Incorrect pot ticket end id");
    expect(await hotpot.nextPotTicketIdStart()).to.equal(expected_ticket_end + 1n, "Id of the next pot starting ticket is incorrect");
  });

  it("Should request Chainlink randomness when the pot is filled", async function() {
    const { 
      factory, hotpot_impl, owner, 
      otherAccount, marketplace, hotpot
    } = await loadFixture(
      deployEverythingFixture
    );
    const { nft_collection } = await loadFixture(deployCollectionFixture);

    const trade = tradeToFillThePot(marketplace, nft_collection, 1);

    /*
      Check the event and request data
     */
    const ticket_id_from = 2;
    const ticket_id_to = 120003;
    await trade;
    const request_id = await hotpot.lastRequestId();
    let request_created;
    expect(request_id).to.not.equal(0, "Last request id is not set");
    if (NO_CHAINLINK) {
      [, request_created, ] = await hotpot.randomRequests(request_id);
    }
    else {
      expect(await hotpot.requestIds(0)).to.equal(request_id, "Request ids array is not updated");
      [, request_created, ] = await hotpot.chainlinkRequests(request_id);
    }
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
    if (NO_CHAINLINK) {
      [fulfilled_, exists_, ] = await hotpot.randomRequests(request_id);
    }
    else {
      expect(await hotpot.requestIds(0)).to.equal(request_id, "Request ids array is not updated");
      [fulfilled_, exists_, ] = await hotpot.chainlinkRequests(request_id);
    }
    expect(fulfilled_).to.equal(false, "The request should not be fulfilled before waiting");
    expect(exists_).to.equal(true, "Request should exist");

    //  Manually fulfill the request
    if (NO_CHAINLINK) {
      const salt = generateRandomSalt();
      await hotpot.connect(owner).fulfillRandomWords(request_id, salt);
      [fulfilled_after,,] = await hotpot.randomRequests(request_id);
    }
    else {
      await VRFCoordinator.fulfillRandomWords(request_id, VRFV2Wrapper.target);
      [fulfilled_after,,] = await hotpot.chainlinkRequests(request_id);
    }
    // Ensure the request is fulfilled    
    expect(fulfilled_after).to.equal(true, "The request should be already fulfilled");

    /*
      Check that the winning ids are set, unique and within range
     */
    const current_pot_id = await hotpot.currentPotId();
    const ticket_id_from = await hotpot.potTicketIdStart();
    const ticket_id_to = await hotpot.potTicketIdEnd();
    const winning_ids = await hotpot.getWinningTicketIds(Number(current_pot_id - 1n));
    expect(winning_ids.length).to.equal(
      await hotpot.numberOfWinners(), "Incorrect number winning ids");
    console.log("Winners:", winning_ids);
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
    
    /* 
      Execute raffle and check winners Prizes 
    */
    expect(hotpot.connect(otherAccount).executeRaffle(winners, amounts))
      .to.be.revertedWith("Caller must be the operator");
    await hotpot.connect(owner).executeRaffle(winners, amounts);
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
    
    await hotpot.connect(owner).executeRaffle(winners, amounts);

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
    if (!NO_CHAINLINK) {
      const LinkToken = await ethers.getContractAt("ERC20", LINK_MAINNET);
      const hotpot_link_balance = await LinkToken.balanceOf(hotpot.target);
      const link_spent = LINK_FUNDING - hotpot_link_balance;

      console.log("LINK spent on VRF fullfillment: ", 
        ethers.formatEther(link_spent.toString())
      );
    }

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
    const item_id = 2;

    await mintAndListNewItem(user2, marketplace, nft_collection, price);
    const trade = marketplace.connect(user1).purchaseItem(item_id, {
      value: trade_amount
    });
    
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
    await tradeToFillThePot(marketplace, nft_collection, item_id + 1);
    const request_id = await hotpot.lastRequestId();
    let fulfilled_;
    let exists_;
    let fulfilled_after;
    expect(request_id).to.not.equal(0, "Last request id is not set");

    if (NO_CHAINLINK) {
      [fulfilled_, exists_, ] = await hotpot.randomRequests(request_id);
    }
    else {
      expect(await hotpot.requestIds(1)).to.equal(request_id, "Request ids array is not updated");
      [fulfilled_, exists_, ] = await hotpot.chainlinkRequests(request_id);
    }
    expect(fulfilled_).to.equal(false, "The request should not be fulfilled before waiting");
    expect(exists_).to.equal(true, "Request should exist");

    //  Manually fulfill the request
    if (NO_CHAINLINK) {
      const salt = generateRandomSalt();
      await hotpot.connect(owner).fulfillRandomWords(request_id, salt);  
      [fulfilled_after,,] = await hotpot.randomRequests(request_id);
    }
    else {
      await VRFCoordinator.fulfillRandomWords(request_id, VRFV2Wrapper.target);
      [fulfilled_after,,] = await hotpot.chainlinkRequests(request_id);
    }

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

  // TODO: pause and check that actions are unavailable. only owner can pause
  // TODO: calculate coverage
  // TODO: add a test case for upgrading the implementation
});
