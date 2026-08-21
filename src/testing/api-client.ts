import request from "supertest";
import type { Express } from "express";
import { CSRF_COOKIE, CSRF_HEADER } from "../api/cookies.js";

export const TEST_EMAIL = "francisco@example.com";
export const TEST_PASSWORD = "contrasena-larga-1";

export function readCookie(res: request.Response, name: string): string {
  const raw = (res.headers["set-cookie"] as unknown as string[] | undefined) ?? [];

  for (const cookie of raw) {
    const [pair] = cookie.split(";");
    const index = pair.indexOf("=");
    if (pair.slice(0, index) === name) {
      return decodeURIComponent(pair.slice(index + 1));
    }
  }

  return "";
}

// habla con la API como lo haría el dashboard: guarda las cookies y repite el token CSRF
// en el header en cada petición que cambia algo
export class ApiClient {
  private agent: ReturnType<typeof request.agent>;
  private csrf = "";

  constructor(private app: Express) {
    this.agent = request.agent(app);
  }

  async handshake(): Promise<void> {
    const res = await this.agent.get("/api/auth/me");
    this.csrf = readCookie(res, CSRF_COOKIE);
  }

  private remember(res: request.Response): request.Response {
    const rotated = readCookie(res, CSRF_COOKIE);
    if (rotated !== "") {
      this.csrf = rotated;
    }
    return res;
  }

  get(url: string) {
    return this.agent.get(url);
  }

  async post(url: string, body?: unknown) {
    return this.remember(await this.agent.post(url).set(CSRF_HEADER, this.csrf).send(body ?? {}));
  }

  async patch(url: string, body?: unknown) {
    return this.remember(await this.agent.patch(url).set(CSRF_HEADER, this.csrf).send(body ?? {}));
  }

  async delete(url: string) {
    return this.remember(await this.agent.delete(url).set(CSRF_HEADER, this.csrf));
  }

  /** Igual que post pero sin el header CSRF, para probar que la defensa corta. */
  postWithoutCsrf(url: string, body?: unknown) {
    return this.agent.post(url).send(body ?? {});
  }

  /** Igual que post pero con un token CSRF inventado. */
  postWithCsrf(url: string, token: string, body?: unknown) {
    return this.agent.post(url).set(CSRF_HEADER, token).send(body ?? {});
  }

  async setup(token: string, email = TEST_EMAIL, password = TEST_PASSWORD) {
    await this.handshake();
    return this.post("/api/auth/setup", { token, email, password });
  }

  async login(email = TEST_EMAIL, password = TEST_PASSWORD) {
    if (this.csrf === "") {
      await this.handshake();
    }
    return this.post("/api/auth/login", { email, password });
  }

  get application(): Express {
    return this.app;
  }
}

export async function signedIn(app: Express, setupToken: string): Promise<ApiClient> {
  const client = new ApiClient(app);
  await client.setup(setupToken);
  return client;
}
