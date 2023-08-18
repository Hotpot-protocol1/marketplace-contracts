const listingTypes = {
  OfferItem: [
    { name: 'offerToken', type: 'address' },
    { name: 'offerTokenId', type: 'uint256' },
    { name: 'offerAmount', type: 'uint256' },
    { name: 'endTime', type: 'uint256' },
  ],
  RoyaltyData: [
    { name: 'royaltyPercent', type: 'uint256' },
    { name: 'royaltyRecipient', type: 'address' },
  ],
  Order: [
    { name: 'offerer', type: 'address' },
    { name: 'offerItem', type: 'OfferItem' },
    { name: 'royalty', type: 'RoyaltyData' },
    { name: 'salt', type: 'uint256' },
  ],
};

module.exports = {
  listingTypes
}