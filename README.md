# Hotpot protocol contracts

## Description
* NFTMarketplace.sol - The marketplace contract. Uses EIP712 for order encoding and validation. This is the entry point - users call this contract to buy Nfts. This contract calls Hotpot on every trade to generate raffle tickets. 
* Hotpot.sol - the main raffle contract. Is responsible for processing a trade and generating raffle tickets. Intergrates Chainlink for winning ticket ids random generation. The raffle funds are stored in this contract as pure ether, and can be claimed by raffle winners later.
* HotpotFactory.sol - is used to deploy Hotpot proxy contracts and upgrade their implementation.

## Testing
```
npm install [--force]
npx hardhat test
```
