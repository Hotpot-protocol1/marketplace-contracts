// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {EIP712Upgradeable, ECDSAUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {IOrderFulfiller} from "./interface/IOrderFulfiller.sol";
import "./interface/IHotpot.sol";
import "./interface/IMarketplace.sol";

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
    address public operator;

    // Status
    mapping(bytes32 => OrderStatus) public orderStatus; // order hash => OrderStatus

    /* 
        EIP712
     */
    bytes32 public DOMAIN_SEPARATOR;
    bytes32 constant OFFER_ITEM_TYPEHASH = keccak256(
        "OfferItem(address offerToken,uint256 offerTokenId,uint256 offerAmount,uint256 endTime)"
    ); 
    bytes32 constant ROYALTY_DATA_TYPEHASH = keccak256(
        "RoyaltyData(uint256 royaltyPercent,address royaltyRecipient)"
    ); 
    bytes32 constant PENDING_AMOUNT_DATA_TYPEHASH = keccak256(
        "PendingAmountData(uint256 offererPendingAmount,uint256 buyerPendingAmount,bytes32 orderHash)"
    ); 
    // Order typehash - this is a structured data, that user signs when listing
    bytes32 constant ORDER_TYPEHASH = keccak256(
        "Order(address offerer,OfferItem offerItem,RoyaltyData royalty,uint256 salt)OfferItem(address offerToken,uint256 offerTokenId,uint256 offerAmount,uint256 endTime)RoyaltyData(uint256 royaltyPercent,address royaltyRecipient)"
    );

    /* 
        Constants
     */
    uint256 constant HUNDRED_PERCENT = 10000;

    constructor() {
        _disableInitializers();
    }

    function initialize(uint16 _raffleTradeFee, address _operator)
        external 
        initializer
    {
        __ReentrancyGuard_init();
        __Ownable_init();
        __EIP712_init("Hotpot", "0.1.0");
        raffleTradeFee = _raffleTradeFee;
        operator = _operator;
        DOMAIN_SEPARATOR = _domainSeparatorV4();
    }

    function fulfillOrder(OrderParameters memory parameters)
        external 
        payable
        nonReentrant 
    {
        OfferItem memory offerItem = parameters.offerItem;
        RoyaltyData memory royalty = parameters.royalty;
        PendingAmountData memory pendingAmounts = parameters.pendingAmountsData;
        address payable offerer = parameters.offerer;
        address buyer = msg.sender;
        uint256 hotpotFeeAmount = offerItem.offerAmount * raffleTradeFee / HUNDRED_PERCENT;
        uint256 royaltyAmount = 
            offerItem.offerAmount * royalty.royaltyPercent / HUNDRED_PERCENT;

        uint256 tradeAmount = offerItem.offerAmount + hotpotFeeAmount + royaltyAmount;
        require(msg.value >= tradeAmount, "Insufficient ether provided");

        //check if offer has expired
        require(block.timestamp <= parameters.offerItem.endTime, 
            "Offer has expired");

        /* 
            Calculating EIP712 hash of the order data and validating it
            agains the specified signature
         */
        bytes32 _orderHash = _validateOrderData(parameters);

        // Doing the same with pending amount data
        _validatePendingAmountData(
            parameters.pendingAmountsData, parameters.pendingAmountsSignature
        );

        // Validate and update order status
        OrderStatus storage _orderStatus = orderStatus[_orderHash];
        _validateOrderStatus(_orderStatus);
        _orderStatus.isFulfilled = true;

        /* 
            Transfer ether to all recepients
            and the NFT to the caller
         */
        {
            // Transfer native currency to the offerer
            offerer.transfer(offerItem.offerAmount);
            
            // Transfer NFT to the caller
            IERC721(offerItem.offerToken).safeTransferFrom(
                offerer, buyer, offerItem.offerTokenId
            );

            // Transfer royalty
            if (royalty.royaltyRecipient != address(0) && royaltyAmount > 0) {
                royalty.royaltyRecipient.transfer(royaltyAmount);
            }
        }
        
        /* 
            Execute Hotpot trade to generate tickets
         */
        address _raffleContract = raffleContract;
        if (_raffleContract != address(0)) {
            IHotpot(_raffleContract).executeTrade{ value: hotpotFeeAmount }(
                tradeAmount,
                buyer,
                offerer,
                pendingAmounts.buyerPendingAmount,
                pendingAmounts.offererPendingAmount
            );
        }
        
        emit OrderFulfilled(
            offerer,
            buyer,
            offerItem.offerToken,
            offerItem.offerTokenId,
            tradeAmount,
            _orderHash
        );
    }

    function cancelOrder(PureOrder memory order)
        external
        nonReentrant
    {
        require(msg.sender == order.offerer, "Caller must be orderer");
        /* 
            Obtain order hash and validate status
         */
        bytes32 _hash = _calculatePureOrderTypedHash(order);
        OrderStatus storage _orderStatus = orderStatus[_hash];
        require(!_orderStatus.isCancelled, "Order is already cancelled");
        require(!_orderStatus.isFulfilled, "Cannot cancel fulfilled order");
        _orderStatus.isCancelled = true;
        emit OrderCancelled(
            order.offerer,
            order.offerItem.offerToken,
            order.offerItem.offerTokenId,
            _hash
        );
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

    function setOperator(address _newOperator) external onlyOwner {
        require(_newOperator != operator, "Operator didnt change");
        operator = _newOperator;
        IHotpot(raffleContract).setOperator(_newOperator);
        emit OperatorChanged(_newOperator);
    }

    function _validateOrderData(OrderParameters memory parameters) 
        internal
        view
        returns(bytes32 orderHash)
    {
        orderHash = _hashTypedDataV4(_calculateOrderHashStruct(parameters));
        address orderSigner = ECDSAUpgradeable.recover(orderHash, parameters.orderSignature);
        // validate signer
        require(orderSigner == parameters.offerer, "Offerer address must be the signer");
        require(msg.sender != parameters.offerer, "Signer cannot fulfill their own order");
    }

    function _validatePendingAmountData(
        PendingAmountData memory pendingAmounts, bytes memory signature
    )
        internal
        view
    {
        bytes32 pendingAmountsHashStruct = _calculatePendingAmountHashStruct(pendingAmounts);
        bytes32 _hash = _hashTypedDataV4(pendingAmountsHashStruct);
        address signer = ECDSAUpgradeable.recover(_hash, signature);
        // validate signer
        require(signer == operator, "Operator must be the pending amounts data signer");
    }

    function _calculateOrderHashStruct(OrderParameters memory parameters) 
        internal 
        pure
        returns(bytes32 _orderHash) 
    {
        return keccak256(abi.encode(
            ORDER_TYPEHASH,
            parameters.offerer,
            _calculateOfferItemHashStruct(parameters.offerItem),
            _calculateRoyaltyDataHashStruct(parameters.royalty),
            parameters.salt
        ));
    }

    function _calculatePureOrderTypedHash(PureOrder memory order) 
        internal 
        view
        returns(bytes32 _orderHash) 
    {
        bytes32 hashStruct = keccak256(abi.encode(
            ORDER_TYPEHASH,
            order.offerer,
            _calculateOfferItemHashStruct(order.offerItem),
            _calculateRoyaltyDataHashStruct(order.royalty),
            order.salt
        ));
        _orderHash = _hashTypedDataV4(hashStruct);
    }

    function _calculateOfferItemHashStruct(OfferItem memory offerItem) 
        internal
        pure
        returns(bytes32 _offerItemHash)
    {
        return keccak256(abi.encode(
            OFFER_ITEM_TYPEHASH,
            offerItem.offerToken,
            offerItem.offerTokenId,
            offerItem.offerAmount,
            offerItem.endTime 
        ));
    }

    function _calculateRoyaltyDataHashStruct(RoyaltyData memory royaltyData) 
        internal
        pure
        returns(bytes32 _royaltyHash) 
    {
        return keccak256(abi.encode(
            ROYALTY_DATA_TYPEHASH,
            royaltyData.royaltyPercent,
            royaltyData.royaltyRecipient
        ));
    }

    function _calculatePendingAmountHashStruct(PendingAmountData memory pendingAmounts) 
        internal
        pure
        returns(bytes32 _pendingAmountsHash) 
    {
        return keccak256(abi.encode(
            PENDING_AMOUNT_DATA_TYPEHASH,
            pendingAmounts.offererPendingAmount,
            pendingAmounts.buyerPendingAmount,
            pendingAmounts.orderHash
        ));
    }

    function _validateOrderStatus(OrderStatus storage _orderStatus) 
        internal
        view
    {
        require(!_orderStatus.isCancelled, 
            "Order is cancelled and cannot be fulfilled");
        require(!_orderStatus.isFulfilled, "Order is already fulfilled");
    }

}