/**
 * Progress-photo API - GET/POST /orders/{order_id}/photos.
 *
 * Confirmed against backend source (app/api/v1/endpoints/orders.py,
 * app/models/order_progress_photo.py): photos are timeline events, not
 * order statuses. Response includes tailor_id, sequence, and
 * visible_to_customer, and the list is always returned ordered by
 * sequence then uploaded_at - do not re-sort client-side.
 */
import { request } from "../../services/api";

export interface OrderProgressPhoto {
  id: number;
  photo_url: string;
  tailor_id: number | null;
  stage: string;
  caption: string | null;
  sequence: number;
  visible_to_customer: boolean;
  uploaded_at: string | null;
}

export interface OrderPhotosResponse {
  order_id: number;
  photos: OrderProgressPhoto[];
}

export async function fetchOrderPhotos(orderId: number): Promise<OrderPhotosResponse> {
  return request<OrderPhotosResponse>(`/orders/${orderId}/photos`);
}

export interface UploadOrderPhotoOptions {
  /** Stage this photo represents - must be one of the tailor's active stitching stages. */
  stage?: "stitching_started" | "in_progress" | "final_check";
  caption?: string;
  /** Whether the customer can see this photo. Defaults true (backend default). */
  visibleToCustomer?: boolean;
}

export async function uploadOrderPhoto(
  orderId: number,
  fileUri: string,
  options: UploadOrderPhotoOptions = {},
): Promise<OrderProgressPhoto> {
  const { stage = "in_progress", caption, visibleToCustomer = true } = options;
  const form = new FormData();
  const filename = fileUri.split("/").pop() ?? "photo.jpg";
  const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
  const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

  form.append("photo", { uri: fileUri, name: filename, type: mime } as any);
  form.append("stage", stage);
  if (caption) form.append("caption", caption);
  form.append("visible_to_customer", visibleToCustomer ? "true" : "false");

  return request<OrderProgressPhoto>(`/orders/${orderId}/photos`, {
    method: "POST",
    body: form,
  });
}

/** Human-readable label for each tailor progress stage. */
export function stageLabel(stage: string): string {
  const labels: Record<string, string> = {
    measuring: "Measuring",
    stitching_started: "Stitching Started",
    in_progress: "In Progress",
    final_check: "Final Check",
    ready_for_dispatch: "Ready for Dispatch",
    // Legacy values a photo record from before this redesign may still hold.
    stitching_completed: "Stitching Done",
    delivered: "Delivered",
  };
  return labels[stage] ?? stage.replace(/_/g, " ");
}

/** Stages a tailor may currently upload a new photo for - mirrors backend's _PHOTO_UPLOAD_STAGES. */
export const PHOTO_UPLOAD_STAGE_OPTIONS: { value: "stitching_started" | "in_progress" | "final_check"; label: string }[] = [
  { value: "stitching_started", label: "Stitching Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "final_check", label: "Final Check" },
];
