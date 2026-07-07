/**
 * User profile & account - /api/v1/users/*
 */
import { request } from "../../services/api";

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}

export interface MessageResponse {
  message?: string;
}

/** PATCH /users/change-password */
export async function changePassword(
  payload: ChangePasswordPayload
): Promise<MessageResponse> {
  return request<MessageResponse>("/users/change-password", {
    method: "PATCH",
    body: payload,
  });
}

/** DELETE /users/me */
export async function deleteAccount(): Promise<MessageResponse> {
  return request<MessageResponse>("/users/me", { method: "DELETE" });
}
