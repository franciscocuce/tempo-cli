export type MonitorStatus = "up" | "down" | "paused" | "pending";
export type KeywordMode = "contains" | "absent";

export interface Monitor {
  id: number;
  name: string;
  url: string;
  method: string;
  cron: string;
  expectedStatus: string;
  keyword: string | null;
  keywordMode: KeywordMode;
  timeoutMs: number;
  followRedirects: boolean;
  confirmThreshold: number;
  enabled: boolean;
  isPublic: boolean;
  certExpiresAt: string | null;
  createdAt: string;
  nextRun: string | null;
  status: MonitorStatus;
  lastCheckedAt: string | null;
  lastLatencyMs: number | null;
  lastError: string | null;
  openIncidentSince: string | null;
  uptime24h: number | null;
}

export interface Check {
  id: number;
  monitorId: number;
  monitorName: string;
  checkedAt: string;
  ok: boolean;
  httpStatus: number | null;
  latencyMs: number;
  error: string | null;
}

export interface Incident {
  id: number;
  monitorId: number;
  monitorName: string;
  startedAt: string;
  resolvedAt: string | null;
  cause: string;
  failedChecks: number;
  durationMs: number | null;
}

export interface DayStat {
  day: string;
  total: number;
  failed: number;
  percent: number | null;
  avgLatency: number | null;
}

export interface Uptime {
  total: number;
  failed: number;
  percent: number | null;
}

export interface MonitorStats {
  uptime24h: Uptime;
  uptime7d: Uptime;
  uptime30d: Uptime;
  p50: number | null;
  p95: number | null;
  history: DayStat[];
}

export interface Overview {
  total: number;
  active: number;
  down: number;
  openIncidents: number;
  uptime24h: number | null;
}

export interface Channel {
  id: number;
  type: "discord";
  label: string;
  target: string;
  enabled: boolean;
  readable: boolean;
  createdAt: string;
}

export interface User {
  id: number;
  email: string;
  createdAt: string;
}

export interface PublicMonitor {
  name: string;
  status: MonitorStatus;
  uptime24h: number | null;
  uptime30d: number | null;
  p95: number | null;
  days: (number | null)[];
}

export interface PublicStatus {
  generatedAt: string;
  from: string;
  days: number;
  monitors: PublicMonitor[];
  incidents: {
    monitorName: string;
    startedAt: string;
    resolvedAt: string | null;
    durationMs: number | null;
  }[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const CSRF_COOKIE = "tempo_csrf";
const CSRF_HEADER = "X-Tempo-CSRF";

function csrfToken(): string {
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

// la API contesta { error: "..." } cuando algo sale mal, pero lo que llega por la red
// es texto sin garantías: si no tiene esa forma, devolvemos nada y el llamador pone un default
function errorMessage(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }

  const { error } = payload as { error?: unknown };
  return typeof error === "string" ? error : undefined;
}

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};

  if (method !== "GET") {
    headers[CSRF_HEADER] = csrfToken();
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const payload: unknown = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(errorMessage(payload) ?? `Error ${res.status}`, res.status);
  }

  return payload as T;
}

export const api = {
  me: () => call<User>("GET", "/api/auth/me"),
  login: (email: string, password: string) =>
    call<User>("POST", "/api/auth/login", { email, password }),
  logout: () => call<void>("POST", "/api/auth/logout"),
  setup: (token: string, email: string, password: string) =>
    call<User>("POST", "/api/auth/setup", { token, email, password }),
  changePassword: (current: string, next: string) =>
    call<{ ok: true }>("POST", "/api/auth/password", { current, next }),

  overview: () => call<Overview>("GET", "/api/overview"),
  monitors: () => call<Monitor[]>("GET", "/api/monitors"),
  monitor: (id: number) => call<Monitor>("GET", `/api/monitors/${id}`),
  createMonitor: (input: Record<string, unknown>) => call<Monitor>("POST", "/api/monitors", input),
  updateMonitor: (id: number, patch: Record<string, unknown>) =>
    call<Monitor>("PATCH", `/api/monitors/${id}`, patch),
  deleteMonitor: (id: number) => call<void>("DELETE", `/api/monitors/${id}`),
  checkNow: (id: number) =>
    call<{ ok: boolean; httpStatus: number | null; latencyMs: number; error: string | null }>(
      "POST",
      `/api/monitors/${id}/check`,
    ),
  checks: (id: number, limit = 50) =>
    call<Check[]>("GET", `/api/monitors/${id}/checks?limit=${limit}`),
  stats: (id: number) => call<MonitorStats>("GET", `/api/monitors/${id}/stats`),
  incidents: (params: { monitor?: number; limit?: number; open?: boolean } = {}) => {
    const query = new URLSearchParams();
    if (params.monitor !== undefined) query.set("monitor", String(params.monitor));
    if (params.limit !== undefined) query.set("limit", String(params.limit));
    if (params.open === true) query.set("open", "true");
    return call<Incident[]>("GET", `/api/incidents?${query.toString()}`);
  },

  channels: () => call<Channel[]>("GET", "/api/channels"),
  createChannel: (label: string, target: string) =>
    call<Channel>("POST", "/api/channels", { type: "discord", label, target }),
  toggleChannel: (id: number, enabled: boolean) =>
    call<Channel>("PATCH", `/api/channels/${id}`, { enabled }),
  deleteChannel: (id: number) => call<void>(`DELETE`, `/api/channels/${id}`),
  testChannel: (id: number) => call<{ ok: true }>("POST", `/api/channels/${id}/test`),

  publicStatus: () => call<PublicStatus>("GET", "/api/public/status"),
};
