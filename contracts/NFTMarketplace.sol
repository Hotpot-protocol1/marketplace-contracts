// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {IOrderFulfiller} from "./interface/IOrderFulfiller.sol";
import "./interface/IHotpot.sol";
import "./interface/IMarketplace.sol";
import "./Errors.sol";

contract Marketplace is 
    IMarketplace, 
    IOrderFulfiller, 
    ReentrancyGuardUpgradeable, 
    OwnableUpgradeable,
    EIP712Upgradeable
{
    /* 
    Hotpot variables
     */
    address public raffleContract; 
    uint16 public raffleTradeFee;
    uint256 constant HUNDRED_PERCENT = 10000;
    bytes32 constant ORDER_TYPEHASH = keccak256(""); 

    constructor() {
        _disableInitializers();
    }

    function initialize(uint16 _raffleTradeFee) external initializer {
        __EIP712_init("Hotpot", "0.1.0");
        raffleTradeFee = _raffleTradeFee;
    }

    function fulfillOrder(OrderParameters memory parameters)
        external 
        payable
        nonReentrant 
    {
        OfferItem memory offerItem = parameters.offerItem;
        RoyaltyData memory royalty = parameters.royalty;
        uint256 hotpotFeeAmount = offerItem.offerAmount * raffleTradeFee / HUNDRED_PERCENT;
        uint256 royaltyAmount = 
            offerItem.offerAmount * royalty.royaltyPercent / HUNDRED_PERCENT;

        uint256 requiredEtherValue = offerItem.offerAmount + hotpotFeeAmount + royaltyAmount;
        if (msg.value < requiredEtherValue) {
            revert InsufficientFunds(requiredEtherValue, msg.value);
        }



        // TODO validate signer
        // TODO signer is not caller
        // TODO transfer ether to offerer
        // TODO calculate EIP712 order hash and validate it against signature
        // TODO transfer token to caller
        // TODO call Hotpot executeTrade
        // TODO validate pending amounts signature
        // TODO validate and update offerStatus
        // TODO emit order fulfilled
    }

    function setRaffleAddress(address _raffleAddress) external onlyOwner {
        require(raffleContract == address(0), 
            "Raffle contract can only be set once");
        address marketplace = IHotpot(_raffleAddress).marketplace();
        require(marketplace == address(this), "Invalid raffle contract");
        raffleContract = _raffleAddress;
        emit RaffleAddressSet(_raffleAddress);
    }

    function setRaffleTradeFee(uint16 _newTradeFee) external onlyOwner {
        require(_newTradeFee <= HUNDRED_PERCENT, "Inadequate marketplace fee");
        raffleTradeFee = _newTradeFee;
        IHotpot(raffleContract).setTradeFee(_newTradeFee);
        emit RaffleTradeFeeChanged(_newTradeFee);
    }

}