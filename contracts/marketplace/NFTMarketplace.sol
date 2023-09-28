// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./MarketplaceBase.sol";

contract Marketplace is MarketplaceBase {
    function fulfillOrder(OrderParameters memory parameters) 
        external payable override nonReentrant
    {
        address buyer = msg.sender;
        OfferItem memory offerItem = parameters.offerItem;
        RoyaltyData memory royalty = parameters.royalty;
        PendingAmountData memory pendingAmounts = parameters.pendingAmountsData;
        uint256 tradeAmount = _calculateTradeAmount(
            offerItem.offerAmount, 
            royalty.royaltyPercent
        );
        uint256 hotpotFeeAmount = _getHotpotFeeAmount(tradeAmount);
        uint256 royaltyAmount = _getRoyaltyAmount(
            tradeAmount, royalty.royaltyPercent
        );
        require(msg.value >= tradeAmount, "Insufficient ether provided");

        // validating and fulfilling the order
        _fulfillOrder(parameters, buyer, royaltyAmount, tradeAmount);

        /* 
            Execute Hotpot trade to generate tickets
         */
        address _raffleContract = raffleContract;
        if (_raffleContract != address(0)) {
            IHotpot(_raffleContract).executeTrade(
                tradeAmount,
                hotpotFeeAmount,
                buyer,
                parameters.offerer,
                pendingAmounts.buyerPendingAmount,
                pendingAmounts.offererPendingAmount
            );
        }
    } 
}