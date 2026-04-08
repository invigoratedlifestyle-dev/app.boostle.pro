export function generateTicketId() {
  const date = new Date();

  const y = date.getFullYear().toString().slice(-2);
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  const random = Math.random().toString(36).substring(2, 6).toUpperCase();

  return `BST-${y}${m}${d}-${random}`;
}