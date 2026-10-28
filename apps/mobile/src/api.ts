import * as SecureStore from "expo-secure-store";
import * as Network from "expo-network";
import Constants from "expo-constants";

const SERVER_URL_KEY = "estoque.server.url";
const API_PORT = Number(process.env.EXPO_PUBLIC_API_PORT ?? Constants.expoConfig?.extra?.apiPort ?? 3000) || 3000;
const SCAN_CONCURRENCY = 48;
const SCAN_TIMEOUT_MS = 1500;
let currentApiUrl: string | null = null;
let discovery: Promise<string | null> | null = null;

export const SERVER_NOT_FOUND_MESSAGE = "Servidor do estoque não encontrado na rede. Confira se o computador da loja está ligado com o sistema iniciado e se o celular está no mesmo Wi-Fi.";

export function getApiUrl() {
  return currentApiUrl;
}

export function getServerOrigin() {
  return currentApiUrl?.replace(/\/api\/?$/, "") ?? "";
}

export function normalizeServerUrl(value: string) {
  let url = value.trim().replace(/\/+$/, "");
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  const match = url.match(/^(https?:\/\/[^/:]+)(:\d+)?(\/.*)?$/i);
  if (!match) return null;
  const path = match[3] && match[3] !== "/" ? match[3] : "/api";
  return `${match[1]}${match[2] ?? `:${API_PORT}`}${path}`;
}

async function isEstoqueApi(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${url}/health`, { signal: controller.signal });
    const body = await response.json().catch(() => null) as { service?: string } | null;
    return response.ok && body?.service === "estoque-api";
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function rememberServer(url: string) {
  currentApiUrl = url;
  await SecureStore.setItemAsync(SERVER_URL_KEY, url).catch(() => undefined);
  return url;
}

function knownCandidates(saved: string | null) {
  const configured = process.env.EXPO_PUBLIC_API_URL ?? Constants.expoConfig?.extra?.apiUrl;
  const metroHost = Constants.expoConfig?.hostUri?.split(":")[0];
  const candidates = [saved, typeof configured === "string" ? normalizeServerUrl(configured) : null, metroHost ? normalizeServerUrl(metroHost) : null];
  return candidates.filter((candidate, index): candidate is string => !!candidate && candidates.indexOf(candidate) === index);
}

// The store server gets its IP from DHCP and it changes; probe every address of the phone's /24 network.
async function scanLocalNetwork() {
  const ip = await Network.getIpAddressAsync().catch(() => null);
  const match = ip?.match(/^(\d+\.\d+\.\d+)\.(\d+)$/);
  if (!match || ip === "0.0.0.0") return null;
  const [, prefix, own] = match;
  const hosts = Array.from({ length: 254 }, (_, index) => index + 1).filter((host) => String(host) !== own);
  let next = 0;
  let found: string | null = null;
  async function worker() {
    while (!found && next < hosts.length) {
      const url = `http://${prefix}.${hosts[next++]}:${API_PORT}/api`;
      if (await isEstoqueApi(url, SCAN_TIMEOUT_MS)) found ??= url;
    }
  }
  await Promise.all(Array.from({ length: SCAN_CONCURRENCY }, worker));
  return found;
}

async function discoverServer() {
  const saved = await SecureStore.getItemAsync(SERVER_URL_KEY).catch(() => null);
  for (const candidate of knownCandidates(saved)) {
    if (await isEstoqueApi(candidate, 2500)) return rememberServer(candidate);
  }
  const scanned = await scanLocalNetwork();
  return scanned ? rememberServer(scanned) : null;
}

export async function resolveServer(force = false) {
  if (currentApiUrl && !force) return currentApiUrl;
  discovery ??= discoverServer().finally(() => { discovery = null; });
  return discovery;
}

export async function setServerAddress(value: string) {
  const url = normalizeServerUrl(value);
  if (!url) throw new Error("Endereço inválido. Informe, por exemplo, 192.168.0.10 ou 192.168.0.10:3000.");
  if (!(await isEstoqueApi(url, 4000))) throw new Error(`O servidor do estoque não respondeu em ${url}.`);
  return rememberServer(url);
}

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
  size?: number | null;
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
  const method = (options.method ?? "GET").toUpperCase();
  const retryable = method === "GET" || method === "HEAD" || headers.has("Idempotency-Key") || path === "/auth/login";
  let baseUrl = await resolveServer();
  if (!baseUrl) throw new Error(SERVER_NOT_FOUND_MESSAGE);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  } catch {
    // The server may have changed address; rediscover it and retry requests that are safe to repeat.
    baseUrl = await resolveServer(true);
    if (!baseUrl) throw new Error(SERVER_NOT_FOUND_MESSAGE);
    if (!retryable) throw new Error(`A conexão com o servidor foi interrompida. Verifique se a operação foi registrada antes de tentar novamente.`);
    try {
      response = await fetch(`${baseUrl}${path}`, { ...options, headers });
    } catch {
      throw new Error(SERVER_NOT_FOUND_MESSAGE);
    }
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
