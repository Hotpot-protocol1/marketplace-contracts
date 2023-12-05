const { Network } = require('./scripts/utils/utils')

const LINK = {
  [Network.EthereumSepolia]: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
  [Network.Ethereum]: "0x514910771AF9Ca656af840dff83E8264EcF986CA"
}

const VRFV2Wrapper = {
  [Network.Ethereum]: "0x5A861794B927983406fCE1D062e00b9368d97Df6",
  [Network.EthereumSepolia]: "0xab18414CD93297B0d12ac29E63Ca20f515b3DB46",
  [Network.EthereumGoerli]: "0x708701a1DfF4f478de54383E49a627eD4852C816",
  [Network.Polygon]: "0x4e42f0adEB69203ef7AaA4B7c414e5b1331c14dc",
}

module.exports = {
  LINK,
  VRFV2Wrapper
}