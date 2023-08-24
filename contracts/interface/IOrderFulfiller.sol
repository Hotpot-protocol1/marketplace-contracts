interface IOrderFulfiller {
    struct OrderParameters {
        address payable offerer;
        OfferItem offerItem;
        RoyaltyData royalty;
        PendingAmountData pendingAmountsData;
        uint256 salt;
        bytes orderSignature;
        bytes pendingAmountsSignature;
    }

    // Order without pending amounts
    struct PureOrder { 
        address payable offerer;
        OfferItem offerItem;
        RoyaltyData royalty;
        uint256 salt;
    }

    struct OfferItem {
        address offerToken;
        uint256 offerTokenId;
        uint256 offerAmount; // the amount of ether for the offerer
        uint256 endTime; // offer expiration timestamp
    }

    struct RoyaltyData {
        uint256 royaltyPercent;
        address payable royaltyRecipient;
    }

    struct PendingAmountData {
        uint256 offererPendingAmount;
        uint256 buyerPendingAmount;
        bytes32 orderHash;
    }

    struct OrderStatus {
        bool isFulfilled;
        bool isCancelled;
    }

    event OrderFulfilled(
        address offerer,
        address buyer,
        address offerToken,
        uint256 tokenId,
        uint256 tradeAmount,
        bytes32 orderHash
    );
    event OrderCancelled(
        address offerer,
        address offerToken,
        uint256 tokenId,
        bytes32 orderHash
    );

    function fulfillOrder(OrderParameters memory parameters) external payable;

}