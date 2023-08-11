interface IOrderFulfiller {
    struct OrderParameters {
        address payable offerer;
        OfferItem offerItem;
        RoyaltyData royalty;
        PendingAmountData pendingAmountsData;
        bytes offerSignature;
        bytes pendingAmountsSignature;
    }

    struct OfferItem {
        address offerToken;
        uint256 offerTokenId;
        uint256 offerAmount; // the amount of ether for the offerer
        uint256 endTime; // offer expiration timestamp
    }

    struct RoyaltyData {
        uint256 royaltyPercent;
        address royaltyRecipient;
    }

    struct PendingAmountData {
        uint256 offererPendingAmount;
        uint256 buyerPendingAmount;
        bytes32 offerHash;
    }

    event OrderFulfilled();

    function fulfillOrder(OrderParameters memory parameters) external payable;

}