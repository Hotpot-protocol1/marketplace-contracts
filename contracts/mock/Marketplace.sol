// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;
import {IHotpot} from "../interface/IHotpot.sol";

contract MarketplaceMock {

    constructor() payable {}

    receive() external payable {}

    function trade(
      	address _hotpot, 
		uint256 _amount,
		address _buyer, 
		address _seller,
		uint256 _buyerPendingAmount,
		uint256 _sellerPendingAmount
    ) external {
        uint256 _value = _amount * 100 / 10000; // 1% of trade amount
		require(_value > 0, "Trade fee transferred must be non-zero");
        IHotpot(_hotpot).executeTrade{ value: _value }(
            _amount,
            _buyer, 
            _seller,
            _buyerPendingAmount,
            _sellerPendingAmount
        );
    }
}