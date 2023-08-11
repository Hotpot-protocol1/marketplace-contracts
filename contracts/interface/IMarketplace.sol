pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IMarketplace {
    struct Item {
        uint itemId;
        IERC721 nft;
        uint tokenId;
        uint price;
        address payable seller;
        bool sold;
    }

    event RaffleTradeFeeChanged(uint16 _newTradeFee);
    event RaffleAddressSet(address _raffleAddress);

}