// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;
import {EIP712, ECDSA} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {IOrderFulfiller} from "../interface/IOrderFulfiller.sol";


contract TestVerify is EIP712("Hotpot", "0.1.0") {
    bytes32 public DOMAIN_SEPARATOR;
    bytes32 constant OFFER_ITEM_TYPEHASH = keccak256(
        "OfferItem(address offerToken,uint256 offerTokenId,uint256 offerAmount,uint256 endTime)"
    ); 
    bytes32 constant ROYALTY_DATA_TYPEHASH = keccak256(
        "RoyaltyData(uint256 royaltyPercent,address royaltyRecipient)"
    ); 
    bytes32 constant ORDER_TYPEHASH = keccak256(
        "Order(address offerer,OfferItem offerItem,RoyaltyData royalty,uint256 salt)OfferItem(address offerToken,uint256 offerTokenId,uint256 offerAmount,uint256 endTime)RoyaltyData(uint256 royaltyPercent,address royaltyRecipient)"
    );

    constructor() {
        DOMAIN_SEPARATOR = _domainSeparatorV4();
    }

    function foo(bytes memory signature, IOrderFulfiller.PureOrder memory order) external view returns(bool) {
        _validateOrderData(order, signature);
        return true;
    }

    function _validateOrderData(IOrderFulfiller.PureOrder memory parameters, bytes memory signature) 
        internal
        view
        returns(bytes32 orderHash)
    {
        orderHash = _hashTypedDataV4(_calculateOrderHashStruct(parameters));
        address orderSigner = ECDSA.recover(orderHash, signature);
        // validate signer
        require(orderSigner == parameters.offerer, "Offerer address must be the signer");
        require(msg.sender != parameters.offerer, "Signer cannot fulfill their own order");
    }

    function _calculateOrderHashStruct(IOrderFulfiller.PureOrder memory parameters) 
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

    function _calculateOfferItemHashStruct(IOrderFulfiller.OfferItem memory offerItem) 
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

    function _calculateRoyaltyDataHashStruct(IOrderFulfiller.RoyaltyData memory royaltyData) 
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
}