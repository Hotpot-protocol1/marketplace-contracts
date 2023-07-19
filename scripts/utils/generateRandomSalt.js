function generateRandomSalt() {
  return Math.floor(Math.random() * 10**8);
}

module.exports = {
  generateRandomSalt
}