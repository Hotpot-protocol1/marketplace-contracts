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

    struct Prize {
        uint128 amount;
        uint128 deadline;
    }

    event RaffleTradeFeeChanged(uint16 _newTradeFee);
    event RaffleAddressSet(address _raffleAddress);
    event OperatorChanged(address _newOperator);
    event Claim(address indexed user, uint256 amount);
    event WinnersAssigned(address[] _winners);

    function initialize(
        uint16 _raffleTradeFee, 
        address _operator,
        uint128 _claimWindow
    ) external; 
    function claim() external;
    function executeRaffle(address[] calldata _winners) external;
    function updatePrizeAmount(uint128 _newPrizeAmount) external;
}