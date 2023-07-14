// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IHotpot {
    struct Prize {
        uint128 amount;
        uint128 deadline;
    }

    struct InitializeParams {
        uint256 potLimit;
        uint256 raffleTicketCost;
        uint128 claimWindow;
        uint16 numberOfWinners;
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
    event WinnersAssigned(
        address[] _winners, 
        uint128[] _amounts
    );
    event RandomWordRequested(
        uint256 requestId, 
        uint32 fromTicketId, 
        uint32 toTicketId 
    );
    event RandomnessFulfilled(
        uint16 indexed potId, 
        uint256 randomWord
    );
    event Claim(address indexed user, uint256 amount);
    event MarketplaceUpdated(address _newMarketplace);
    event OperatorUpdated(address _newOperator);

    function initialize(address _owner, InitializeParams calldata params) external;

    function executeTrade(
        uint256 _amount, 
        address _buyer, 
        address _seller, 
        uint256 _buyerPendingAmount, 
        uint256 _sellerPendingAmount
    ) external payable;

    function executeRaffle(
        address[] calldata _winners,
        uint128[] calldata _amounts) external;

    function claim() external;
}