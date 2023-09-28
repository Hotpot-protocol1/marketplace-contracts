// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IHotpot {

    struct InitializeParams {
        uint256 potLimit;
        uint256 raffleTicketCost;
        uint16 fee;
        uint16 tradeFee;
        address marketplace;
        address operator;
    }

    struct RequestStatus {
        bool fullfilled;
        bool exists;
        uint256 randomWord;
    }

	event GenerateRaffleTickets(
		address indexed _buyer,
		address indexed _seller, 
		uint32 _buyerTicketIdStart,
		uint32 _buyerTicketIdEnd,
		uint32 _sellerTicketIdStart,
		uint32 _sellerTicketIdEnd,
		uint256 _buyerPendingAmount,
		uint256 _sellerPendingAmount
	);
    event RandomWordRequested(
        uint256 requestId, 
        uint32 fromTicketId, 
        uint32 toTicketId 
    );
    event CrosschainTradeExecuted(
        
    );
    event RandomnessFulfilled(
        uint16 indexed potId, 
        uint256 randomWord
    );
    event MarketplaceUpdated(address _newMarketplace);
    event OperatorUpdated(address _newOperator);
    event AirdropAddressUpdated(address _newAidrop);
    event PrizeAmountsUpdated(uint128[] _newPrizeAmounts);
    event NumberOfWinnersUpdated(uint16 _nOfWinners);
    event GenerateAirdropTickets(
        address indexed user, 
        uint32 ticketIdStart,
        uint32 ticketIdEnd
    );
    event CallbackGasLimitUpdated(uint32 _callbackGasLimit);

    function initialize(address _owner, InitializeParams calldata params) external;

    function executeTrade(
        uint256 _amount, 
        uint256 _raffleFee,
        address _buyer, 
        address _seller, 
        uint256 _buyerPendingAmount, 
        uint256 _sellerPendingAmount
    ) external;
    function claimAirdropTickets(address user, uint32 tickets) external;
    function setTradeFee(uint16 _newTradeFee) external;
    function setOperator(address _newOperator) external;
    function marketplace() external returns(address);
}