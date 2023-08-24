function generateSalt() {
  return BigInt(Math.floor(Math.random() * 10000))
}

module.exports = {
  generateSalt
}