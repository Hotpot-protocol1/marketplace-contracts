// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./MarketplaceBase.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";

contract MarketplaceCrosschain is MarketplaceBase {
    IRouterClient public immutable ccipRouter;
    address public immutable linkToken;

    constructor(address _ccipRouter, address _linkToken) {
        ccipRouter = IRouterClient(_ccipRouter);
        linkToken = _linkToken;
    }

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
            bytes memory data = abi.encodePacked(
                tradeAmount,
                hotpotFeeAmount,
                buyer,
                parameters.offerer,
                pendingAmounts.buyerPendingAmount,
                pendingAmounts.offererPendingAmount
            );
            Client.EVM2AnyMessage memory evm2AnyMessage = Client.EVM2AnyMessage({
                receiver: abi.encode(_raffleContract),
                data: abi.encode(data),
                tokenAmounts: new Client.EVMTokenAmount[](0), // Empty array indicating no tokens are being sent
                extraArgs: Client._argsToBytes(
                    // Additional arguments, setting gas limit and non-strict sequencing mode
                    Client.EVMExtraArgsV1({gasLimit: 200_000, strict: false})
                ),
                // Set the feeToken  address, indicating LINK will be used for fees
                feeToken: address(linkToken)
            });

            // Get the fee required to send the message
            uint256 fees = router.getFee(destinationChainSelector, evm2AnyMessage);

            if (fees > linkToken.balanceOf(address(this)))
                revert NotEnoughBalance(linkToken.balanceOf(address(this)), fees);

            // approve the Router to transfer LINK tokens on contract's behalf. It will spend the fees in LINK
            linkToken.approve(address(router), fees);

            // Send the message through the router and store the returned message ID
            messageId = router.ccipSend(destinationChainSelector, evm2AnyMessage);
        }
    }
}