import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? Constants.expoConfig?.extra?.apiUrl ?? "http://localhost:3000/api";
const TOKEN_KEY = "estoque.session.token";
let unauthorizedHandler: (() => Promise<void> | void) | undefined;

export function setUnauthorizedHandler(handler?: () => Promise<void> | void) {
  unauthorizedHandler = handler;
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) { super(message); }
}

export type User = { id: string; name: string; login: string; role: "ADMIN" | "VENDEDOR" };
export type Balance = { id: string; name: string; status: string; itemCount: number; myCountedItemCount: number };
export type BalanceItem = {
  id: string;
  referenceQuantity: string;
  status: "PENDENTE" | "CONTADO" | "EM_REVISAO" | "APROVADO";
  product: { id: string; internalCode: string; name: string; unit: string; photoUrl?: string | null; category: { name: string } };
  counts: { id: string; quantity: string; countedAt: string; isRecount: boolean }[];
};

export async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function saveToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function api<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error(`Não foi possível conectar ao servidor (${API_URL}). Confira se o celular está na mesma rede local do computador e tente novamente.`);
  }
  const body = await response.json().catch(() => null) as { error?: { message?: string; code?: string } } | null;
  if (!response.ok) {
    if (response.status === 401 && token) await unauthorizedHandler?.();
    throw new ApiError(body?.error?.message ?? `Servidor retornou ${response.status}.`, response.status, body?.error?.code);
  }
  return body as T;
}

export async function login(loginValue: string, password: string) {
  return api<{ token: string; user: User }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ login: loginValue, password })
  });
}

export function idempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
}
