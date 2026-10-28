import { DanOAuthError } from "./errors.js";
import { encodeScope, generateState, verifyState } from "./scope.js";
import type {
  AuthorizationUrl,
  AuthorizationUrlOptions,
  CallbackParams,
  CitizenData,
  DanOAuthOptions,
  RawServiceResponse,
  ServiceResult,
  TokenResponse,
} from "./types.js";

const DEFAULT_BASE_URL = "https://sso.gov.mn";
const DEFAULT_TIMEOUT_MS = 15_000;

export class DanOAuth {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly baseUrl: string;
  readonly #clientSecret: string;
  readonly #timeoutMs: number;
  readonly #fetch: typeof fetch;

  constructor(options: DanOAuthOptions) {
    for (const key of ["clientId", "clientSecret", "redirectUri"] as const) {
      if (!options?.[key]) throw new TypeError(`DanOAuth: "${key}" is required`);
    }
    this.clientId = options.clientId;
    this.#clientSecret = options.clientSecret;
    this.redirectUri = options.redirectUri;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const f = options.fetch ?? globalThis.fetch;
    if (typeof f !== "function") {
      throw new TypeError("DanOAuth: global fetch is not available, pass options.fetch (Node.js >= 18 required)");
    }
    this.#fetch = f;
  }

  /** Step 1.1 — URL to redirect the citizen's browser to. */
  getAuthorizationUrl(options: AuthorizationUrlOptions): AuthorizationUrl {
    const state = options.state ?? generateState();
    const scope = typeof options.scope === "string" ? options.scope : encodeScope(options.scope);
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope,
      state,
    });
    if (options.loginType) params.set("login_type", options.loginType);
    return { url: `${this.baseUrl}/oauth2/authorize?${params.toString()}`, state };
  }

  /**
   * Step 1.2 — validates the redirect back from DAN and returns the grant code.
   * Throws when the state does not match (possible CSRF) or the citizen declined.
   */
  validateCallback(params: CallbackParams | URLSearchParams | string, expectedState: string | null | undefined): string {
    const p = normalizeCallback(params);
    if (p.error) {
      throw new DanOAuthError("ACCESS_DENIED", p.error_description || p.error, { body: p });
    }
    if (!verifyState(expectedState, p.state)) {
      throw new DanOAuthError("STATE_MISMATCH", "OAuth state mismatch — request rejected");
    }
    if (!p.code) throw new DanOAuthError("MISSING_CODE", "Callback does not contain a grant code");
    return p.code;
  }

  /** Steps 1.3–1.4 — exchanges the grant code for a (single use, short lived) access token. */
  async getAccessToken(code: string): Promise<TokenResponse> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: this.clientId,
      client_secret: this.#clientSecret,
      redirect_uri: this.redirectUri,
    });
    const { status, data } = await this.#request("TOKEN_REQUEST_FAILED", "/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: body.toString(),
    });
    if (!isObject(data) || typeof data.access_token !== "string") {
      throw new DanOAuthError("INVALID_RESPONSE", "Token response does not contain access_token", { status, body: data });
    }
    return data as TokenResponse;
  }

  /** Steps 1.5–1.6 — raw body of `GET /oauth2/api/v1/service`. */
  async getServiceResponse(accessToken: string, tokenType = "Bearer"): Promise<RawServiceResponse> {
    const { status, data } = await this.#request("SERVICE_REQUEST_FAILED", "/oauth2/api/v1/service", {
      method: "GET",
      headers: { Authorization: `${tokenType} ${accessToken}`, Accept: "application/json" },
    });
    if (!Array.isArray(data)) {
      throw new DanOAuthError("INVALID_RESPONSE", "Service response is not an array", { status, body: data });
    }
    return data as RawServiceResponse;
  }

  /** Steps 1.5–1.6 — citizen data, with service results flattened by service code. */
  async getCitizenData(accessToken: string, tokenType = "Bearer"): Promise<CitizenData> {
    return parseServiceResponse(await this.getServiceResponse(accessToken, tokenType));
  }

  /**
   * Whole callback in one call: validate state → exchange code → fetch citizen data.
   *
   * ```ts
   * const data = await dan.handleCallback(req.query, req.session.danState);
   * ```
   */
  async handleCallback(
    params: CallbackParams | URLSearchParams | string,
    expectedState: string | null | undefined,
  ): Promise<CitizenData & { token: TokenResponse }> {
    const code = this.validateCallback(params, expectedState);
    const token = await this.getAccessToken(code);
    const data = await this.getCitizenData(token.access_token, token.token_type || "Bearer");
    return { ...data, token };
  }

  async #request(
    failCode: "TOKEN_REQUEST_FAILED" | "SERVICE_REQUEST_FAILED",
    path: string,
    init: RequestInit,
  ): Promise<{ status: number; data: unknown }> {
    let res: Response;
    try {
      res = await this.#fetch(`${this.baseUrl}${path}`, { ...init, signal: AbortSignal.timeout(this.#timeoutMs) });
    } catch (cause) {
      throw new DanOAuthError("NETWORK_ERROR", `Request to ${path} failed: ${(cause as Error)?.message ?? cause}`, {
        cause,
      });
    }
    const text = await res.text();
    let data: unknown = text;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      // keep raw text
    }
    if (!res.ok) {
      const detail = isObject(data) ? (data.error_description ?? data.error ?? data.message) : undefined;
      throw new DanOAuthError(failCode, `DAN ${path} responded ${res.status}${detail ? `: ${detail}` : ""}`, {
        status: res.status,
        body: data,
      });
    }
    return { status: res.status, data };
  }
}

/** Flattens DAN's `[ {citizen_loginType}, {services, wsdl}, ... ]` body. */
export function parseServiceResponse(raw: RawServiceResponse): CitizenData {
  let loginType: number | undefined;
  const services: Record<string, ServiceResult> = {};
  for (const item of raw) {
    if (!isObject(item)) continue;
    if ("citizen_loginType" in item && loginType === undefined) {
      const v = Number(item.citizen_loginType);
      if (!Number.isNaN(v)) loginType = v;
    }
    if (isObject(item.services)) Object.assign(services, item.services);
  }
  return { loginType, services, raw };
}

function normalizeCallback(params: CallbackParams | URLSearchParams | string): CallbackParams {
  if (typeof params === "string") {
    const query = params.includes("?") ? params.slice(params.indexOf("?") + 1) : params;
    params = new URLSearchParams(query);
  }
  if (params instanceof URLSearchParams) {
    return {
      code: params.get("code"),
      state: params.get("state"),
      error: params.get("error"),
      error_description: params.get("error_description"),
    };
  }
  // Express-style query objects may contain arrays for repeated keys — take the first value.
  const first = (v: unknown) => (Array.isArray(v) ? v[0] : v) as string | null | undefined;
  return {
    code: first(params.code),
    state: first(params.state),
    error: first(params.error),
    error_description: first(params.error_description),
  };
}

function isObject(v: unknown): v is Record<string, any> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
