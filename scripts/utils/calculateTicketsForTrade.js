const { INITIAL_TICKET_COST } = require('./parameters');

function calculateTicketsForTrade(
  trade_amount, 
  last_ticket_id,
  buyer_pending_amount,
  seller_pending_amount
) {
  const buyer_tickets = Number((trade_amount + buyer_pending_amount) 
    / INITIAL_TICKET_COST);
  const seller_tickets = Number((trade_amount + seller_pending_amount) / 
    INITIAL_TICKET_COST);
  const buyer_ticket_start = buyer_tickets > 0 ? last_ticket_id + 1 : 0;
  const buyer_ticket_end = buyer_tickets > 0 ? 
    (buyer_ticket_start + buyer_tickets - 1) : 0;
  const seller_ticket_start = seller_tickets > 0 ? buyer_ticket_end + 1 : 0;
  const seller_ticket_end = seller_tickets > 0 ? 
    (seller_ticket_start + seller_tickets - 1) : 0;

  return {
    buyer_tickets,
    seller_tickets,
    buyer_ticket_start,
    buyer_ticket_end,
    seller_ticket_start,
    seller_ticket_end
  }
}

module.exports = {
  calculateTicketsForTrade
}