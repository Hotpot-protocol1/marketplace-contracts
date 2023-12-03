// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract BoostedERC721Mock is ERC721 {
    uint256 public lastTokenId;

    constructor() ERC721("Boosted Collection", "VIP") {}

    function mint(address to) external {
        lastTokenId++;
        _mint(to, lastTokenId);
    }
}