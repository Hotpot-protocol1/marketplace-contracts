// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "./interface/IHotpot.sol";
import "./interface/IMarketplace.sol";

contract Marketplace is IMarketplace, OwnableUpgradeable, ReentrancyGuardUpgradeable {

    /* 
    Hotpot variables
     */
    address public raffleContract; 
    uint256 constant HUNDRED_PERCENT = 10000;
    uint16 public raffleTradeFee;

    constructor() {
        _disableInitializers();
    }

    function initialize(uint16 _raffleTradeFee) external initializer {
        raffleTradeFee = _raffleTradeFee;
    }

    function fulfillOrder() external nonReentrant {

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