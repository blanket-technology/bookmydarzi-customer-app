/**
 * Account security — /api/v1/users/change-email/* and change-mobile/*
 */
import { request } from "../../services/api";

export interface MessageResponse {
  message?: string;
}

/** POST /users/change-email/request */
export async function requestChangeEmail(newEmail: string): Promise<MessageResponse> {
  return request<MessageResponse>("/users/change-email/request", {
    method: "POST",
    body: { email: newEmail },
  });
}

/** POST /users/change-email/verify */
export async function verifyChangeEmail(
  newEmail: string,
  otp: string
): Promise<MessageResponse> {
  return request<MessageResponse>("/users/change-email/verify", {
    method: "POST",
    body: { email: newEmail, otp },
  });
}

/** POST /users/change-mobile/verify-current/request */
export async function requestVerifyCurrentMobile(): Promise<MessageResponse> {
  return request<MessageResponse>("/users/change-mobile/verify-current/request", {
    method: "POST",
    body: {},
  });
}

/** POST /users/change-mobile/verify-current */
export async function verifyCurrentMobile(otp: string): Promise<MessageResponse> {
  return request<MessageResponse>("/users/change-mobile/verify-current", {
    method: "POST",
    body: { otp },
  });
}

/** POST /users/change-mobile/request */
export async function requestChangeMobile(newMobile: string): Promise<MessageResponse> {
  return request<MessageResponse>("/users/change-mobile/request", {
    method: "POST",
    body: { phone: newMobile, new_mobile: newMobile },
  });
}

/** POST /users/change-mobile/verify */
export async function verifyChangeMobile(
  newMobile: string,
  otp: string
): Promise<MessageResponse> {
  return request<MessageResponse>("/users/change-mobile/verify", {
    method: "POST",
    body: { phone: newMobile, new_mobile: newMobile, otp },
  });
}
