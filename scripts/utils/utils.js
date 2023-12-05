getRandomFloat = (min, max) => Math.random() * (max - min) + min;

const Network = {
  Ethereum: 1,
  Polygon: 137,
  EthereumGoerli: 5,
  EthereumSepolia: 11155111,
}

module.exports = {getRandomFloat, Network} 