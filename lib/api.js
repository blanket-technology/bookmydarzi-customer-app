import { buildApiV1Url } from "../src/config/api";

/**
 * Internal helper — fires a fetch request and normalises errors.
 * Throws a plain Error with a user-friendly message on failure.
 */
async function request(endpoint, options = {}) {
  let response;

  try {
    response = await fetch(buildApiV1Url(endpoint), {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    throw new Error("Network error. Please check your connection.");
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message ?? `Request failed (${response.status})`);
  }

  return data;
}

// ---------------------------------------------------------------------------
// Auth endpoints
// ---------------------------------------------------------------------------

/**
 * POST /login
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ token: string }>}
 */
export async function loginUser(email, password) {
  return request("/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

/**
 * POST /signup
 * @param {{
 *   name: string,
 *   email: string,
 *   password: string,
 *   phone_number: string,
 *   address?: string
 * }} data
 * @returns {Promise<{ token: string }>}
 */
export async function signupUser(data) {
  return request("/signup", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * POST /forgot-password
 * @param {string} email
 * @returns {Promise<{ message: string }>}
 */
export async function forgotPassword(email) {
  return request("/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}
