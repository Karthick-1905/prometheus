/** Shared HTTP/SSE client for the FastAPI backend. */

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const SESSION_KEY = 'cat_rental_session';
const GET_CACHE_TTL_MS = 15_000;

interface CachedResponse {
  expiresAt: number;
  value: unknown;
}

const responseCache = new Map<string, CachedResponse>();
const inFlightRequests = new Map<string, Promise<unknown>>();
let cacheGeneration = 0;

export interface ApiSession {
  accessToken?: string;
  actorId: string;
  role: string;
  companyId?: number | null;
  dealerId?: number | null;
  siteId?: number | null;
}

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export function readApiSession(): ApiSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as ApiSession) : null;
  } catch {
    return null;
  }
}

export function writeApiSession(session: ApiSession | null) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
  clearRequestCache();
}

/** Clear cached GETs after a mutation or identity change. */
export function clearRequestCache() {
  cacheGeneration += 1;
  responseCache.clear();
  inFlightRequests.clear();
}

function authHeaders(): Record<string, string> {
  const session = readApiSession();
  if (!session) return {};
  if (session.accessToken) return { Authorization: `Bearer ${session.accessToken}` };
  return {
    'X-Actor-Id': session.actorId,
    'X-User-Role': session.role,
    ...(session.companyId != null ? { 'X-Company-Id': String(session.companyId) } : {}),
    ...(session.dealerId != null ? { 'X-Dealer-Id': String(session.dealerId) } : {}),
    ...(session.siteId != null ? { 'X-Site-Id': String(session.siteId) } : {}),
  };
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    if (!response.ok) {
      return {
        detail:
          response.status >= 500
            ? 'The backend could not complete this request. Check its database and service dependencies.'
            : text,
      };
    }
    throw new ApiError(
      `The server returned an unreadable response (${response.status}).`,
      response.status,
      text,
    );
  }
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = {
    Accept: 'application/json',
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...authHeaders(),
    ...(init.headers ?? {}),
  };
  const canCache = method === 'GET' && !init.signal && init.cache !== 'no-store';
  const cacheKey = canCache
    ? JSON.stringify([
        `${BASE}${path}`,
        Object.entries(headers).sort(([left], [right]) => left.localeCompare(right)),
      ])
    : null;

  if (cacheKey) {
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value as T;
    if (cached) responseCache.delete(cacheKey);

    const pending = inFlightRequests.get(cacheKey);
    if (pending) return pending as Promise<T>;
  }

  const pending = performRequest<T>(path, init, headers);
  if (cacheKey) {
    const requestGeneration = cacheGeneration;
    inFlightRequests.set(cacheKey, pending);
    try {
      const value = await pending;
      if (requestGeneration === cacheGeneration) {
        responseCache.set(cacheKey, {
          expiresAt: Date.now() + GET_CACHE_TTL_MS,
          value,
        });
      }
      return value;
    } finally {
      if (inFlightRequests.get(cacheKey) === pending) inFlightRequests.delete(cacheKey);
    }
  }

  const value = await pending;
  if (method !== 'GET') clearRequestCache();
  return value;
}

async function performRequest<T>(
  path: string,
  init: RequestInit,
  headers: HeadersInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      cache: init.cache ?? 'default',
      ...init,
      headers,
    });
  } catch (error) {
    throw new ApiError(
      'Cannot reach the backend API. Start FastAPI on port 8000 and try again.',
      0,
      error,
    );
  }
  const payload = (await parseResponse(response)) as Record<string, unknown> | null;
  const backendMessage =
    typeof payload?.detail === 'string'
      ? payload.detail
      : typeof payload?.error === 'string'
        ? payload.error
        : typeof payload?.message === 'string'
          ? payload.message
          : null;
  if (!response.ok || payload?.success === false) {
    throw new ApiError(
      backendMessage ?? `Backend request failed with status ${response.status}.`,
      response.status,
      payload,
    );
  }
  return payload as T;
}

export function query(
  path: string,
  params: Record<string, string | number | boolean | null | undefined>,
) {
  const values = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') values.set(key, String(value));
  });
  const suffix = values.toString();
  return suffix ? `${path}?${suffix}` : path;
}

export function idempotencyKey(prefix: string) {
  const suffix =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${suffix}`;
}

export function backendRootPath() {
  return BASE ? '/' : '/backend-root';
}

export interface StreamEvent<T = unknown> {
  id?: string;
  event: string;
  data: T;
}

/** Read a finite backend SSE stream while preserving bearer/header authentication. */
export async function readEventStream(
  path: string,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'text/event-stream', ...authHeaders() },
    signal,
  });
  if (!response.ok || !response.body) {
    const payload = await parseResponse(response);
    throw new ApiError(
      (payload as { detail?: string } | null)?.detail ??
        `Live stream failed with status ${response.status}.`,
      response.status,
      payload,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
    let boundary = buffer.indexOf('\n\n');
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const parsed: { id?: string; event: string; data?: unknown } = { event: 'message' };
      for (const line of block.split('\n')) {
        const split = line.indexOf(':');
        if (split < 0) continue;
        const field = line.slice(0, split);
        const raw = line.slice(split + 1).trimStart();
        if (field === 'id') parsed.id = raw;
        if (field === 'event') parsed.event = raw;
        if (field === 'data') {
          try {
            parsed.data = JSON.parse(raw);
          } catch {
            parsed.data = raw;
          }
        }
      }
      onEvent({ id: parsed.id, event: parsed.event, data: parsed.data });
      boundary = buffer.indexOf('\n\n');
    }
  }
}
