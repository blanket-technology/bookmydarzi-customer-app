import { request } from "../../services/api";
import type { CustomerOrderDetails } from "../types/customerOrders";

/**
 * Self-service pickup reschedule - PATCH /customer/orders/{id}/reschedule-pickup
 * (app/api/v1/endpoints/customer_orders.py). Only succeeds while the order
 * is in pickup_scheduled/pickup_pending (the backend's RESCHEDULABLE_FROM,
 * see admin_reschedule_service.py) - i.e. only after a Bridge/employee has
 * already been assigned and made the first scheduling call. Callers must
 * gate the reschedule button on the same statuses (see
 * order-details.tsx's RESCHEDULABLE_STATUSES) so the request isn't
 * attempted needlessly.
 */
export async function reschedulePickup(
  orderId: number,
  scheduledPickupAt: string,
  pickupTimeSlot?: string,
): Promise<CustomerOrderDetails> {
  const res = await request<{ order: CustomerOrderDetails }>(
    `/customer/orders/${orderId}/reschedule-pickup`,
    {
      method: "PATCH",
      body: {
        scheduled_pickup_at: scheduledPickupAt,
        pickup_time_slot: pickupTimeSlot ?? null,
      },
    },
  );
  return res.order;
}
