// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract ERC1155Mock is ERC1155 {
    uint256 public lastTokenId;

    constructor() ERC1155("www") {}

    function mint(address to, uint256 amount) external {
        require(amount > 0, "Amount must not be zero");
        lastTokenId++;
        bytes memory data = "";
        _mint(to, lastTokenId, amount, data);
    }
}