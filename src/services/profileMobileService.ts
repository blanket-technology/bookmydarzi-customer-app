/**
 * Changing an existing number uses /users/change-mobile/* (OTP).
 * Adding a first number uses PATCH /users/profile with `phone`.
 */
import {
  requestChangeMobile,
  requestVerifyCurrentMobile,
  verifyChangeMobile,
  verifyCurrentMobile,
} from "./accountSecurityService";
import { normalizeTenDigitMobile } from "../utils/userPhone";

export async function sendOtpToAddOrChangeMobile(newMobile: string): Promise<string> {
  const mobile = normalizeTenDigitMobile(newMobile);
  if (mobile.length !== 10) {
    throw new Error("Enter a valid 10-digit mobile number.");
  }
  await requestChangeMobile(mobile);
  return mobile;
}

export async function verifyNewMobileOtp(
  newMobile: string,
  otp: string,
): Promise<void> {
  const mobile = normalizeTenDigitMobile(newMobile);
  const code = otp.trim();
  if (mobile.length !== 10) {
    throw new Error("Enter a valid 10-digit mobile number.");
  }
  if (!/^\d{6}$/.test(code)) {
    throw new Error("Enter the 6-digit OTP.");
  }
  await verifyChangeMobile(mobile, code);
}

export async function sendOtpToVerifyCurrentMobile(): Promise<void> {
  await requestVerifyCurrentMobile();
}

export async function verifyCurrentMobileOtp(otp: string): Promise<void> {
  const code = otp.trim();
  if (!/^\d{6}$/.test(code)) {
    throw new Error("Enter the 6-digit OTP.");
  }
  await verifyCurrentMobile(code);
}
