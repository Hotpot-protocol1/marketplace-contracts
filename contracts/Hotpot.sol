// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {IHotpot} from "./interface/IHotpot.sol";
import {VRFV2WrapperConsumerBase} from "@chainlink/contracts/src/v0.8/VRFV2WrapperConsumerBase.sol";
import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import {CCIPReceiver} from "@chainlink/contracts-ccip/src/v0.8/ccip/applications/CCIPReceiver.sol";

contract Hotpot is 
    IHotpot, 
    OwnableUpgradeable, 
    PausableUpgradeable, 
    VRFV2WrapperConsumerBase,
    CCIPReceiver
{
    uint256 public potLimit;
    uint256 public currentPotSize;
    uint256 public raffleTicketCost;
    mapping(uint256 => RequestStatus) public chainlinkRequests;
    mapping(uint16 => uint32[]) public winningTicketIds;
    uint256[] public requestIds;
    uint256 public lastRequestId;
    uint16 public fee; // 100 = 1%, 10000 = 100%;
    uint16 public tradeFee; // the percent of a trade amount that goes to the pot as pure ether
    uint32 public lastRaffleTicketId;
    uint32 public potTicketIdStart; // start of current pot ticket range
    uint32 public potTicketIdEnd; // end of current pot ticket range
    uint32 public nextPotTicketIdStart;
    uint16 public currentPotId;
    address public marketplace;
    address public crosschainMarketplace;
    address public operator;
    address public airdrop; // airdrop contract
    uint32 private callbackGasLimit;
    uint64 private immutable senderChainSelector;
    uint256 constant MULTIPLIER = 10000;

    modifier onlyMarketplace() {
        require(msg.sender == marketplace, "Caller is not the marketplace contract");
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operator, "Caller must be the operator");
        _;
    }

    modifier onlyAirdrop() {
        require(msg.sender == airdrop, "Anauthorized call - not an airdrop contract");
        _;
    }

    constructor(
        address _link, 
        address _vrfV2Wrapper,
        address _ccipRouter,
        uint64 _senderChainSelector
    ) VRFV2WrapperConsumerBase(_link, _vrfV2Wrapper) CCIPReceiver(_ccipRouter) {
        _disableInitializers();
        senderChainSelector = _senderChainSelector;
    }
    
    function initialize(address _owner, InitializeParams calldata params) external initializer {
        __Ownable_init();
        __Pausable_init();
        transferOwnership(_owner);

        potLimit = params.potLimit;
        raffleTicketCost = params.raffleTicketCost;
        fee = params.fee;
        tradeFee = params.tradeFee;
        lastRaffleTicketId = 1;
        potTicketIdStart = 1;
        potTicketIdEnd = 1;
        lastRequestId = 1;
        currentPotId = 1;
        nextPotTicketIdStart = 2; // first ticket of the first pot
        marketplace = params.marketplace;
        operator = params.operator;
    }

    function executeTrade(
        uint256 _amountInWei,
        uint256 _raffleFee,
        address _buyer, 
        address _seller, 
        uint256 _buyerPendingAmount, 
        uint256 _sellerPendingAmount
    ) external onlyMarketplace whenNotPaused {
        _executeTrade(
            _amountInWei,
            _raffleFee,
            _buyer,
            _seller,
            _buyerPendingAmount,
            _sellerPendingAmount
        );
    }

    function getWinningTicketIds(uint16 _potId) external view returns(uint32[] memory) {
        return winningTicketIds[_potId];
    }

    function claimAirdropTickets(
        address user,
        uint32 tickets
    ) external onlyAirdrop {
        if (tickets == 0) {
            return;
        }
        uint32 ticketIdStart = lastRaffleTicketId + 1;
        uint32 ticketIdEnd = ticketIdStart + tickets - 1;
        lastRaffleTicketId = ticketIdEnd;
        emit GenerateAirdropTickets(
            user,
            ticketIdStart,
            ticketIdEnd
        );
    }

    /* 

        ***
        SETTERS
        ***

     */

    function setMarketplace(address _newMarketplace) external onlyOwner {
        require(marketplace != _newMarketplace, "Address didn't change");
        marketplace = _newMarketplace;
        emit MarketplaceUpdated(_newMarketplace);
    }

    function setCrosschainMarketplace(address _marketplace) external onlyOwner {
        crosschainMarketplace = _marketplace;
    }

    function setOperator(address _newOperator) external onlyMarketplace {
        operator = _newOperator;
    }

    function setAirdropContract(address _newAirdropContract) external onlyOwner {
        require(airdrop != _newAirdropContract, "Address didn't change");
        airdrop = _newAirdropContract;
        emit AirdropAddressUpdated(_newAirdropContract);
    }

    function setRaffleTicketCost(uint256 _newRaffleTicketCost) external onlyOwner {
        require(raffleTicketCost != _newRaffleTicketCost, "Cost must be different");
        require(_newRaffleTicketCost > 0, "Raffle cost must be non-zero");
        raffleTicketCost = _newRaffleTicketCost;
    }

    function setPotLimit(uint256 _newPotLimit) external onlyOwner {
        require(potLimit != _newPotLimit, "Pot limit must be different");
        potLimit = _newPotLimit;
    }

    function setTradeFee(uint16 _newTradeFee) external onlyMarketplace {
        tradeFee = _newTradeFee;
    }

    function setChainlinkGasLimit(
        uint32 _callbackGasLimit
    ) external onlyOwner {
        callbackGasLimit = _callbackGasLimit;
        emit CallbackGasLimitUpdated(_callbackGasLimit);
    }

    /* 

            ***
            INTERNAL
            ***
     */

    function _executeTrade(
        uint256 _amountInWei,
        uint256 _raffleFee,
        address _buyer, 
        address _seller, 
        uint256 _buyerPendingAmount, 
        uint256 _sellerPendingAmount
    ) internal {   
        uint256 _currentPotSize = currentPotSize;
		uint256 _potLimit = potLimit;
		uint256 _raffleTicketCost = raffleTicketCost;
        uint32 _lastRaffleTicketIdBefore = lastRaffleTicketId;

        _processTickets(
            _amountInWei,
            _buyer,
            _seller,
            _buyerPendingAmount,
            _sellerPendingAmount,
            _raffleTicketCost
        );

        /*
            Request Chainlink random winners if the Pot is filled 
         */
		if(_currentPotSize + _raffleFee >= _potLimit) {
            _finishRaffle(
                _raffleFee, 
                _lastRaffleTicketIdBefore,
                _potLimit,
                _currentPotSize
            );
        }
		else {
			currentPotSize += _raffleFee;
		}
    }

    function _processTickets(
        uint256 _amountInWei, 
        address _buyer, 
        address _seller, 
        uint256 _buyerPendingAmount, 
        uint256 _sellerPendingAmount,
        uint256 _raffleTicketCost
    ) internal returns(
        uint256 _newBuyerPendingAmount,
        uint256 _newSellerPendingAmount
    ) {
        require(_buyer != _seller, "Buyer and seller must be different");
        uint32 buyerTickets = uint32((_buyerPendingAmount + _amountInWei) / _raffleTicketCost);
		uint32 sellerTickets = uint32((_sellerPendingAmount + _amountInWei) / _raffleTicketCost);
		_newBuyerPendingAmount = (_buyerPendingAmount + _amountInWei) % _raffleTicketCost;
		_newSellerPendingAmount = (_sellerPendingAmount + _amountInWei) % _raffleTicketCost;
        
        _generateTickets(_buyer, _seller, buyerTickets, sellerTickets,
            _newBuyerPendingAmount, _newSellerPendingAmount);
    }
    
    function _generateTickets(
        address _buyer,
        address _seller,
        uint32 buyerTickets, 
        uint32 sellerTickets,
        uint256 _newBuyerPendingAmount,
        uint256 _newSellerPendingAmount
    ) internal {
        uint32 buyerTicketIdStart;
        uint32 buyerTicketIdEnd;
        uint32 sellerTicketIdStart;
        uint32 sellerTicketIdEnd;

        /*
            Assigning newly generated ticket ranges 
        */
        if(buyerTickets > 0) {
            buyerTicketIdStart = lastRaffleTicketId + 1;
            buyerTicketIdEnd = buyerTicketIdStart + buyerTickets - 1; 
        }
        if (sellerTickets > 0) {
            bool buyerGetsNewTickets = buyerTicketIdEnd > 0;
            sellerTicketIdStart = buyerGetsNewTickets ? 
                buyerTicketIdEnd + 1 : lastRaffleTicketId + 1;
            sellerTicketIdEnd = sellerTicketIdStart + sellerTickets - 1;
        }
        lastRaffleTicketId += buyerTickets + sellerTickets;

        emit GenerateRaffleTickets(
			_buyer, 
			_seller, 
			buyerTicketIdStart, 
			buyerTicketIdEnd,
            sellerTicketIdStart,
            sellerTicketIdEnd,
			_newBuyerPendingAmount,
			_newSellerPendingAmount
		);
    }

    function _calculateTicketIdEnd(
        uint32 _lastRaffleTicketIdBefore
    ) internal view returns(uint32 _ticketIdEnd) {
		uint256 _raffleTicketCost = raffleTicketCost;
        uint256 _ethDeltaNeededToFillPot = (potLimit - currentPotSize) * MULTIPLIER / (MULTIPLIER - fee);
        uint256 _tradeAmountNeededToFillPot = _ethDeltaNeededToFillPot * MULTIPLIER / tradeFee;
        // First calculate tickets needed to fill the pot
        uint32 ticketsNeeded = uint32(_tradeAmountNeededToFillPot / _raffleTicketCost) * 2;
        
        if(_tradeAmountNeededToFillPot % _raffleTicketCost > 0) {
            ticketsNeeded += 1;
        }
        
        return _lastRaffleTicketIdBefore + ticketsNeeded;
    }

    function _finishRaffle(
        uint256 potValueDelta,
        uint32 _lastRaffleTicketIdBefore,
        uint256 _potLimit,
        uint256 _currentPotSize
    ) internal {
        uint32 _potTicketIdEnd = _calculateTicketIdEnd(_lastRaffleTicketIdBefore);
        potTicketIdEnd = _potTicketIdEnd;
        potTicketIdStart = nextPotTicketIdStart; 
        nextPotTicketIdStart = _potTicketIdEnd + 1; // starting ticket of the next Pot
        // The remainder goes to the next pot
        currentPotSize = (_currentPotSize + potValueDelta) % _potLimit; 
        _requestRandomWinners();
    }

    function _requestRandomWinners() internal {
        uint32 _gasLimit = callbackGasLimit;
        require(_gasLimit > 0, "Gas limit not specified");
        uint256 requestId = requestRandomness(_gasLimit, 3, 1); // TODO if you deploy on Polygon, increase confirmation blocks (check out reorgs)
        chainlinkRequests[requestId].exists = true;
        lastRequestId = requestId;
        requestIds.push(requestId);
        emit RandomWordRequested(requestId, potTicketIdStart, potTicketIdEnd);
    }

    function fulfillRandomWords(uint256 _requestId, uint256[] memory _randomWords) internal override {
        uint256 randomWord = _randomWords[0];
        uint32 rangeFrom = potTicketIdStart;
        uint32 rangeTo = potTicketIdEnd;

        chainlinkRequests[_requestId] = RequestStatus({
            fullfilled: true,
            exists: true,
            randomWord: randomWord
        });

        uint32[] memory derivedRandomWords = new uint32[](1);
        derivedRandomWords[0] = _normalizeValueToRange(randomWord, rangeFrom, rangeTo);
        winningTicketIds[currentPotId] = derivedRandomWords;
        emit RandomnessFulfilled(currentPotId, randomWord);
        currentPotId++;
    }

    function _normalizeValueToRange(
        uint256 _value, uint32 _rangeFrom, uint32 _rangeTo
    ) internal pure returns(uint32 _scaledValue) {
        _scaledValue = uint32(_value) % (_rangeTo - _rangeFrom) + _rangeFrom; // from <= x <= to
    }

    function _incrementRandomValueUntilUnique(
        uint32 _random, 
        uint32[] memory _randomWords, 
        uint32 _rangeFrom,
        uint32 _rangeTo
    ) internal pure returns(uint32 _uniqueRandom) {
        _uniqueRandom = _random;
        for(uint i = 0; i < _randomWords.length;) {
            if(_uniqueRandom == _randomWords[i]) {
                unchecked {
                    _uniqueRandom = _normalizeValueToRange(
                        _uniqueRandom + 1,
                        _rangeFrom,
                        _rangeTo
                    );
                    i = 0;
                }
            }
            else {
                unchecked {
                    i++;
                }
            }
        }
    }

    function _ccipReceive(Client.Any2EVMMessage memory message) internal override {
        address sender = address(bytes20(message.sender));
        require(sender == crosschainMarketplace, 
            "Anauthorized crosschain call");
        (
            uint256 _amountInWei,
            uint256 _raffleFee,
            address _buyer, 
            address _seller, 
            uint256 _buyerPendingAmount, 
            uint256 _sellerPendingAmount
        ) = abi.decode(message.data, (uint256, uint256, address, address, uint256, uint256));

        require(message.sourceChainSelector == senderChainSelector, 
            "Unsupported chain");
        
        _executeTrade(
            _amountInWei,
            _raffleFee,
            _buyer,
            _seller,
            _buyerPendingAmount,
            _sellerPendingAmount
        );
    }
}