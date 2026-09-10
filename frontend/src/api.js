import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
const base = (
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000"
).replace(/\/$/, "");
let token = null;
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};
export async function restoreToken() {
  if (Platform.OS !== "web")
    token = await SecureStore.getItemAsync("gateway-session");
  else {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }
}
export async function saveToken(value) {
  token = value || null;
  if (Platform.OS !== "web") {
    if (token) await SecureStore.setItemAsync("gateway-session", token);
    else await SecureStore.deleteItemAsync("gateway-session");
  }
}
export async function api(path, method = "GET", body) {
  if (Platform.OS !== "web" && !__DEV__ && !base.startsWith("https://"))
    throw new Error(
      "Release builds require an HTTPS API address. Configure EXPO_PUBLIC_API_URL and rebuild.",
    );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${base}${path}`, {
      method,
      credentials: Platform.OS === "web" ? "include" : "omit",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Client": "gateway",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response
      .json()
      .catch(() => ({
        message: "The server returned an unexpected response.",
      }));
    if (!response.ok) {
      if (response.status === 401 && path !== "/user/login") {
        await saveToken(null);
        onUnauthorized();
      }
      throw new Error(data.message || "Request failed");
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError")
      throw new Error(
        "The request timed out. Refresh the list before retrying a saved entry.",
      );
    if (error instanceof TypeError)
      throw new Error(
        "Cannot reach Gateway. Check your connection and the API address.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
