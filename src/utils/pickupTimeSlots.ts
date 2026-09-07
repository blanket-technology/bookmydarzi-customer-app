/**
 * Shared pickup time-slot generator - 9:00 AM to 9:00 PM in 30-minute steps,
 * used identically by both the cart checkout flow (app/(tabs)/cart.tsx) and
 * the "Book Now" direct-checkout flow (app/buy-now-review.tsx). Previously
 * each flow offered only 3 broad windows (e.g. "9 AM - 12 PM"); customers
 * can now pick their exact half-hour within the day.
 */
export interface PickupTimeSlot {
  /** Sent as-is to the backend's free-text PickupTimeSlot column, e.g. "9:30 AM". */
  label: string;
  hour: number;
  minute: number;
}

const START_HOUR = 9;
const END_HOUR = 21; // 9 PM, inclusive as the last selectable start time

export function buildPickupTimeSlots(): PickupTimeSlot[] {
  const slots: PickupTimeSlot[] = [];
  for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
    for (const minute of [0, 30]) {
      if (hour === END_HOUR && minute > 0) break; // stop exactly at 9:00 PM
      const period = hour < 12 ? "AM" : "PM";
      const displayHour = hour % 12 === 0 ? 12 : hour % 12;
      const label = `${displayHour}:${minute === 0 ? "00" : "30"} ${period}`;
      slots.push({ label, hour, minute });
    }
  }
  return slots;
}
