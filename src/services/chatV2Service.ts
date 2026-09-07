import { request } from "../../services/api";

const BASE = "/chat/v2";

export interface ChatSession {
  uuid: string;
  user_id: number;
  order_id: number | null;
  order_code?: string | null;
  issue_category?: string | null;
  status: string;
  assigned_agent_id: number | null;
  ai_handled: boolean;
  last_message_at: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  session_uuid: string;
  seq: number;
  sender_type: "customer" | "agent" | "ai" | "system";
  sender_id: number | null;
  body: string | null;
  message_type: string;
  client_id: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

export async function getOrCreateSession(
  orderId?: number,
  issueCategory?: string,
): Promise<ChatSession> {
  const params = new URLSearchParams();
  if (orderId) params.set("order_id", String(orderId));
  if (issueCategory) params.set("issue_category", issueCategory);
  const qs = params.toString();
  return request<ChatSession>(`${BASE}/sessions${qs ? `?${qs}` : ""}`, { method: "POST" });
}

export async function getSession(sessionUuid: string): Promise<ChatSession> {
  return request<ChatSession>(`${BASE}/sessions/${sessionUuid}`);
}

export async function getMessages(
  sessionUuid: string,
  limit = 50,
  beforeSeq?: number,
): Promise<{ messages: ChatMessage[]; count: number }> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (beforeSeq) params.set("before_seq", String(beforeSeq));
  return request<{ messages: ChatMessage[]; count: number }>(
    `${BASE}/sessions/${sessionUuid}/messages?${params}`,
  );
}

export async function markRead(sessionUuid: string, lastSeq: number): Promise<void> {
  await request(`${BASE}/sessions/${sessionUuid}/read?last_seq=${lastSeq}`, { method: "POST" });
}

export async function rateSession(sessionUuid: string, score: number): Promise<void> {
  await request(`${BASE}/sessions/${sessionUuid}/rate?score=${score}`, { method: "POST" });
}

export async function requestHuman(sessionUuid: string): Promise<{ status: string; session_status: string }> {
  return request(`${BASE}/sessions/${sessionUuid}/request-agent`, { method: "POST" });
}

export interface ChatUploadResult {
  url: string;
  file_id: string;
  mime_type: string;
}

/**
 * Uploads an image to the chat attachment endpoint (ImageKit-backed,
 * validates size + magic bytes server-side). The returned `url` is passed
 * back as `attachment_id` in the send_message WS frame - chat_ws.py only
 * ever stores it opaquely in metadata.attachment_id and echoes it back
 * unchanged, so using the real URL there (instead of an internal id) lets
 * the bubble render the image with zero backend schema changes.
 */
export async function uploadChatAttachment(fileUri: string): Promise<ChatUploadResult> {
  const filename = fileUri.split("/").pop() ?? "attachment.jpg";
  const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
  const mime =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/jpeg";

  const form = new FormData();
  form.append("file", { uri: fileUri, name: filename, type: mime } as any);

  return request<ChatUploadResult>(`${BASE}/upload`, { method: "POST", body: form });
}
