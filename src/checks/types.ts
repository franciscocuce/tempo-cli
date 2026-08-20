export type KeywordMode = "contains" | "absent";

export interface CheckOptions {
  url: string;
  method: string;
  expectedStatus: string;
  keyword: string | null;
  keywordMode: KeywordMode;
  timeoutMs: number;
  followRedirects: boolean;
}

export interface CheckOutcome {
  ok: boolean;
  httpStatus: number | null;
  latencyMs: number;
  error: string | null;
}

export const DEFAULT_METHOD = "GET";
export const DEFAULT_EXPECTED_STATUS = "2xx";
export const DEFAULT_TIMEOUT_MS = 10_000;
export const ALLOWED_METHODS = ["GET", "HEAD", "POST"] as const;
