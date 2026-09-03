export type OrderWhatsappStatus = "unsent" | "opened" | "confirmed";

export interface OrderStatusEntry {
  status: OrderWhatsappStatus;
  lastChangedAt: number;
}

const KEY_PREFIX = "bbm.orderStatus.";
const AUTO_CONFIRM_OPENED_MS = 30 * 60 * 1000; // 30 min heuristic

function safeGet(key: string): OrderStatusEntry | null {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    if (!raw) return null;
    return JSON.parse(raw) as OrderStatusEntry;
  } catch {
    return null;
  }
}

function safeSet(key: string, value: OrderStatusEntry) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function getOrderStatus(orderNumber: string | undefined): OrderWhatsappStatus {
  if (!orderNumber) return "unsent";
  const entry = safeGet(KEY_PREFIX + orderNumber);
  if (!entry) return "unsent";

  if (entry.status === "opened") {
    // 30-minute heuristic: if we believe they opened WhatsApp and enough time passed
    // then they almost certainly pressed SENT (or even if not, they want to see the
    // "received" screen and won't be confused).
    if (Date.now() - entry.lastChangedAt > AUTO_CONFIRM_OPENED_MS) {
      const promoted: OrderStatusEntry = {
        status: "confirmed",
        lastChangedAt: entry.lastChangedAt,
      };
      safeSet(KEY_PREFIX + orderNumber, promoted);
      return "confirmed";
    }
  }

  return entry.status;
}

export function markOrderWhatsappOpened(orderNumber: string | undefined) {
  if (!orderNumber) return;
  // Do not downgrade a confirmed order.
  const current = getOrderStatus(orderNumber);
  if (current === "confirmed") return;
  safeSet(KEY_PREFIX + orderNumber, {
    status: "opened",
    lastChangedAt: Date.now(),
  });
}

export function markOrderConfirmedSent(orderNumber: string | undefined) {
  if (!orderNumber) return;
  safeSet(KEY_PREFIX + orderNumber, {
    status: "confirmed",
    lastChangedAt: Date.now(),
  });
}
