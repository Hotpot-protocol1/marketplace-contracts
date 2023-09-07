// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {BitMaps} from "@openzeppelin/contracts/utils/structs/BitMaps.sol";
import {IHotpot} from "./interface/IHotpot.sol";

contract HotpotMerkleAirdrop is Ownable {
    using BitMaps for BitMaps.BitMap;

    bytes32 public merkleRoot;
    uint256 public startTime;
    uint16 public lastGroupId;
    address public raffleContract;
    address public operator; // backend operator

    struct Duration {
        uint64 start;
        uint64 end;
    }

    mapping(uint16 => Duration) public claimWindow; // group id -> Duration
    mapping(uint16 => BitMaps.BitMap) private _hasClaimed; // group id => user => bool

    event RootSet(bytes32 newRoot, uint16 _lastGroupId);
    event StartedEarly();
    event ClaimWindowUpdated(
        uint16 groupId, 
        uint64 start, 
        uint64 end
    );

    modifier onlyOperator {
        require(msg.sender == operator, "Anauthorized call");
        _;
    }

    /**
     * @param _merkleRoot       Merkle root
     * @param _startTime        Exact time when contract is live
     */
    constructor(
        bytes32 _merkleRoot,
        uint256 _startTime,
        address _raffleContract,
        address _operator
    ) {
        merkleRoot = _merkleRoot;
        startTime = _startTime;
        raffleContract = _raffleContract;
        operator = _operator;
    }

    /**
     *
     *                 CONFIG
     *
     */

    function startNow() external onlyOwner {
        startTime = block.timestamp;
        emit StartedEarly();
    }

    function setRoot(
        bytes32 _merkleRoot, 
        uint16 _lastGroupId
    ) external onlyOperator {
        merkleRoot = _merkleRoot;

        if (_lastGroupId > lastGroupId) {
            lastGroupId = _lastGroupId;
        }

        emit RootSet(_merkleRoot, lastGroupId); 
    }

    function setClaimDurationForGroup(
        uint16 groupId, 
        Duration calldata duration_
    ) external onlyOwner {
        require(duration_.start < duration_.end, "Duration end must be greater than start");
        require(groupId <= lastGroupId, "Group doesn't exist");
        claimWindow[groupId] = duration_;
        emit ClaimWindowUpdated(groupId, duration_.start, duration_.end);
    }

    /**
     *
     *                 VIEWS
     *
     */

    function hasClaimed(
        address user
    ) external view returns (bool[] memory) {
        uint16 _lastGroupId = lastGroupId;
        bool[] memory data = new bool[](_lastGroupId + 1);
        for (uint16 id; id <= _lastGroupId; id++) {
            data[id] = _hasClaimed[id].get(uint256(uint160(user)));
        }

        return data;
    }

    /**
     *
     *                 CLAIM
     *
     */
    function claim(
        bytes32[] calldata _proof,
        address addr,
        uint256[] memory ticketAmounts // amount of tickets for each group
    ) external {
        uint16 _lastGroupId = lastGroupId;
        require(merkleRoot != bytes32(0), "Empty root");
        require(block.timestamp > startTime, "Airdrop hasn't started yet");
        require(ticketAmounts.length - 1 == lastGroupId, 
            "Invalid ticket amounts");
        bytes32 leaf = keccak256(abi.encodePacked(addr, ticketAmounts));
        require(MerkleProof.verifyCalldata(_proof, merkleRoot, leaf), "invalid proof");

        bool isEligible;
        uint256 claimableTickets;
        uint256 ticketsForGroup;
        for (uint16 id = 0; id <= _lastGroupId;) {
            BitMaps.BitMap storage hasClaimedGroup = _hasClaimed[id];
            ticketsForGroup = ticketAmounts[id];
            isEligible = ticketsForGroup > 0;

            assembly {
                id := add(id, 1)
            } // Divided checks to separate `if`s to avoid unnecessary storage read in case of `false` flag
            if (!isEligible || hasClaimedGroup.get(uint256(uint160(addr)))) {
                continue;
            }

            Duration memory claimWindow_ = claimWindow[id - 1];
            if (block.timestamp < claimWindow_.start || block.timestamp > claimWindow_.end) {
                continue;
            }

            unchecked {
                hasClaimedGroup.set(uint256(uint160(addr)));
                claimableTickets += ticketsForGroup;
            }
        }

        // Issueing new tickets
        IHotpot(raffleContract).claimAirdropTickets(
            addr, 
            uint32(claimableTickets)
        );

    }
}