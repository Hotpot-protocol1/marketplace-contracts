// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interface/IHotpot.sol";


contract Marketplace is ReentrancyGuard {

    // Variables
    uint public itemCount; 
    address public owner;
    /* 
    Hotpot variables
     */
    address public raffleContract; 
    uint256 constant RAFFLE_TRADE_FEE = 1000; // 10%
    uint256 constant HUNDRED_PERCENT = 10000;

    struct Item {
        uint itemId;
        IERC721 nft;
        uint tokenId;
        uint price;
        address payable seller;
        bool sold;
    }

    // itemId -> Item
    mapping(uint => Item) public items;

    event Offered(
        uint itemId,
        address indexed nft,
        uint tokenId,
        uint price,
        address indexed seller
    );
    event Bought(
        uint itemId,
        address indexed nft,
        uint tokenId,
        uint price,
        address indexed seller,
        address indexed buyer
    );

    constructor() {
        owner = msg.sender;
    }

    // Make item to offer on the marketplace
    function makeItem(IERC721 _nft, uint _tokenId, uint _price) external nonReentrant {
        require(_price > 0, "Price must be greater than zero");
        // increment itemCount
        itemCount ++;
        // transfer nft
        _nft.transferFrom(msg.sender, address(this), _tokenId);
        // add new item to items mapping
        items[itemCount] = Item (
            itemCount,
            _nft,
            _tokenId,
            _price,
            payable(msg.sender),
            false
        );
        // emit Offered event
        emit Offered(
            itemCount,
            address(_nft),
            _tokenId,
            _price,
            msg.sender
        );
    }

    function purchaseItem(uint _itemId) external payable nonReentrant {
        uint _totalPrice = getTotalPrice(_itemId);
        Item storage item = items[_itemId];
        require(_itemId > 0 && _itemId <= itemCount, "item doesn't exist");
        require(msg.value >= _totalPrice, "not enough ether to cover item price and market fee");
        require(!item.sold, "item already sold");
        // pay seller and feeAccount
        item.seller.transfer(item.price);
        // update item to sold
        item.sold = true;
        // transfer nft to buyer
        item.nft.transferFrom(address(this), msg.sender, item.tokenId);

        /* 
            Hotpot Execute Trade
         */
        address _raffleContract = raffleContract;
        
        if (_raffleContract != address(0)) {
            uint256 fee = item.price * RAFFLE_TRADE_FEE / HUNDRED_PERCENT; 
            IHotpot(_raffleContract).executeTrade{ value: fee }(
                _totalPrice,
                msg.sender,
                item.seller,
                0,
                0
            );
        }
        // emit Bought event
        emit Bought(
            _itemId,
            address(item.nft),
            item.tokenId,
            item.price,
            item.seller,
            msg.sender
        );
    }

    function setRaffleAddress(address raffle) external {
        require(msg.sender == owner, "Only owner");
        raffleContract = raffle;
    }

    function getTotalPrice(uint _itemId) view public returns(uint){
        return((items[_itemId].price * 
            (HUNDRED_PERCENT + RAFFLE_TRADE_FEE)) / HUNDRED_PERCENT);
    }

    function getAllListedNfts() view external returns(Item[] memory) {
        Item[] memory nfts = new Item[](itemCount);
        uint256 totalCount = itemCount;
        uint256 nftCount = 0;
        for(uint i = 0; i < totalCount; i++) {
            Item memory item = items[i + 1];
            if (!item.sold) {
                nfts[nftCount] = item;
                nftCount++;
            }
        }
        return nfts;
    }
}