import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "auth_token";

/**
 * Persist a token securely on the device.
 * @param {string} token
 */
export async function saveToken(token) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

/**
 * Retrieve the stored token, or null if none exists.
 * @returns {Promise<string|null>}
 */
export async function getToken() {
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

/**
 * Delete the stored token (logout / session clear).
 */
export async function removeToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
