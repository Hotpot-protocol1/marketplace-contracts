// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {BitMaps} from "@openzeppelin/contracts/utils/structs/BitMaps.sol";

contract HotpotMerkleAirdrop is Ownable {
    using BitMaps for BitMaps.BitMap;

    bytes32 public merkleRoot;
    uint256 public startTime;

    struct Duration {
        uint64 start;
        uint64 end;
    }

    mapping(bytes32 => Duration) public claimWindow; // groupHash -> Duration
    mapping(bytes32 => BitMaps.BitMap) private _hasClaimed;

    event RootSet(bytes32 newRoot);
    event StartedEarly();
    event Claimed(address addr, uint256 amt);
    event ClaimWindowUpdated(
        string group, 
        uint64 start, 
        uint64 end
    );

    /**
     * @param _merkleRoot       Merkle root
     * @param _startTime        Exact time when contract is live
     */
    constructor(
        bytes32 _merkleRoot,
        uint256 _startTime
    ) {
        merkleRoot = _merkleRoot;
        startTime = _startTime;
    }

    /**
     *
     *                 CONFIG
     *
     */

    function startNow() external {
        require(msg.sender == owner(), "Anauthorized call");
        startTime = block.timestamp;
        emit StartedEarly();
    }

    function setRoot(bytes32 _merkleRoot) external {
        require(msg.sender == owner(), "Anauthorized call");
        merkleRoot = _merkleRoot;
        emit RootSet(_merkleRoot);
    }

    /* function setClaimDurationForGroup(string memory groupName, uint256 size, Duration calldata duration_) external {
        bytes32 groupHash = keccak256(groupName);
        require(msg.sender == owner(), "Anauthorized call");
        require(duration_.start < duration_.end, "Duration end must be greater than start");
        claimWindow[groupHash] = duration_;
    } */

    /**
     *
     *                 VIEWS
     *
     */
    /* function getClaimWindow(
        string memory group
    ) external view returns(uint64 start, uint64 end) {
        bytes32 groupHash = keccak256(group);
        return claimWindow[groupHash];
    } */

    // TODO rewrite hasClaimed
    /* function hasClaimed(
        address user_,
        string memory group
    ) external view returns (bool[] memory) {
        bool[] memory data = new bool[](uint8(CLAIM_TYPE.vlCVX) + 1);
        for (uint8 i; i <= uint8(CLAIM_TYPE.vlCVX); i++) {
            data[i] = _hasClaimed[CLAIM_TYPE(i)].get(uint256(uint160(user_)));
        }

        return data;
    } */

    // TODO isEligible

    /**
     *
     *                 CLAIM
     *
     */
    // TODO rewrite claim
    /* function claim(bytes32[] calldata _proof, address addr, uint16 flags) external returns (bool) {
        require(merkleRoot != bytes32(0), "!root");
        require(block.timestamp > startTime, "!started");
        require(block.timestamp < expiryTime, "!active");
        bytes32 leaf = keccak256(abi.encodePacked(addr, flags));
        require(MerkleProof.verify(_proof, merkleRoot, leaf), "invalid proof");

        bool isEligible;
        uint256 claimAmount;
        uint8 claimsLength = uint8(CLAIM_TYPE.vlCVX);
        for (uint8 i; i <= claimsLength;) {
            CLAIM_TYPE type_ = CLAIM_TYPE(i);

            assembly {
                isEligible := and(shr(i, flags), 0x1)
                i := add(i, 1)
            } // Divided checks to separate `if`s to avoid unnecessary storage read in case of `false` flag
            if (!isEligible || _hasClaimed[type_].get(uint256(uint160(addr)))) {
                continue;
            }

            Duration memory claimWindow_ = claimWindow[type_];
            if (block.timestamp < claimWindow_.start || block.timestamp > claimWindow_.end) {
                continue;
            }

            uint256 remainedClaims = _availableClaims[type_];
            if (remainedClaims == 0) {
                continue;
            }

            unchecked {
                _hasClaimed[type_].set(uint256(uint160(addr)));
                _availableClaims[type_] = remainedClaims - 1;
                claimAmount += CLAIM_AMOUNT;
            }
        }

        toRedeem[addr] += claimAmount;
        emit Claimed(addr, claimAmount);
        return true;
    } */
}