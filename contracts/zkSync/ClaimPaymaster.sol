// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IPaymaster, ExecutionResult, PAYMASTER_VALIDATION_SUCCESS_MAGIC} from "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IPaymaster.sol";
import {IPaymasterFlow} from "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IPaymasterFlow.sol";
import {TransactionHelper, Transaction} from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";
import {ISystemContext} from "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/ISystemContext.sol";
import {HotpotZkSync, IHotpotZkSync} from "../zkSync/HotpotZkSync.sol";

contract ClaimPaymaster is IPaymaster {
    address public raffle;

    modifier onlyBootloader() {
        require(msg.sender == BOOTLOADER_FORMAL_ADDRESS, "Only bootloader can call this method");
        // Continue execution if called from the bootloader.
        _;
    }

    constructor(address _raffle) {
        raffle = _raffle;
    }

    receive() external payable {}

    function validateAndPayForPaymasterTransaction  (
        bytes32,
        bytes32,
        Transaction calldata _transaction
    ) external payable onlyBootloader returns (bytes4 magic, bytes memory context) {
        magic = PAYMASTER_VALIDATION_SUCCESS_MAGIC;

        require(
            _transaction.paymasterInput.length >= 4,
            "The standard paymaster input must be at least 4 bytes long"
        );

        bytes4 paymasterInputSelector = bytes4(_transaction.paymasterInput[0:4]);
        if (paymasterInputSelector == IPaymasterFlow.general.selector)  {
            bytes4 targetSelector = bytes4(_transaction.data[0:4]);
            address txTarget = address(uint160(_transaction.to));
            address user = address(uint160(_transaction.from));
            (uint128 claimableAmount, uint128 deadline) = 
                HotpotZkSync(raffle).claimablePrizes(user);
            uint256 blockTimestamp = ISystemContext(SYSTEM_CONTEXT_CONTRACT).getBlockTimestamp();

            require(targetSelector == IHotpotZkSync.claim.selector, 
                "The Paymaster only sponsors claim() calls");
            require(txTarget == raffle, 
                "Transaction target must be the raffle contract");
            require(claimableAmount > 0 && blockTimestamp < deadline,
                "User is not eligible to claim");
        } else {
            revert("Unsupported paymaster flow");
        }

        uint256 requiredETH = _transaction.gasLimit * _transaction.maxFeePerGas;
        // Transfer fees to the bootloader
        (bool success, ) = payable(BOOTLOADER_FORMAL_ADDRESS).call{
            value: requiredETH
        }("");
        require(success, "Failed to transfer tx fee to the bootloader. Paymaster balance might not be enough.");
    }

    function postTransaction (
        bytes calldata _context,
        Transaction calldata _transaction,
        bytes32,
        bytes32,
        ExecutionResult _txResult,
        uint256 _maxRefundedGas
    ) external payable onlyBootloader override {
    }

}