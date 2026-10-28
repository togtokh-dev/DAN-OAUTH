/** Login method the citizen is offered on the DAN login page. Defaults to `"OTP"` on the DAN side. */
export type LoginType = "OTP" | "signature" | "bank";

/**
 * One group of XYP (ХУР) services that share a WSDL.
 *
 * `params` is only needed for services that take input parameters,
 * keyed by service code, e.g. `{ WS100201_getPropertyInfo: { propertyNumber: "..." } }`.
 */
export interface ServiceGroup {
  services: string[];
  wsdl: string;
  params?: Record<string, Record<string, unknown>>;
}

export interface DanOAuthOptions {
  /** "Client ID" issued by the National Data Center. */
  clientId: string;
  /** "Client Secret Key" issued by the National Data Center. Keep server side only. */
  clientSecret: string;
  /** "Redirect URI" registered with the National Data Center. */
  redirectUri: string;
  /** DAN server origin. Defaults to `https://sso.gov.mn`. */
  baseUrl?: string;
  /** Request timeout in milliseconds for server-to-server calls. Defaults to 15000. */
  timeoutMs?: number;
  /** Custom fetch implementation (for proxies, testing, etc.). Defaults to global `fetch`. */
  fetch?: typeof fetch;
}

export interface AuthorizationUrlOptions {
  /** Service groups to request, or an already encoded scope string. */
  scope: ServiceGroup[] | string;
  /** CSRF state. A random one is generated when omitted. */
  state?: string;
  loginType?: LoginType;
}

export interface AuthorizationUrl {
  url: string;
  /** Store this (e.g. in the session) and compare it in the callback. */
  state: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  /** Lifetime in seconds. DAN issues short lived (≈60s), single use tokens. */
  expires_in: number;
  scope?: string;
  [key: string]: unknown;
}

/** Result of a single XYP service call as returned by DAN. */
export interface ServiceResult<TResponse = any> {
  resultCode: number;
  resultMessage: string;
  request?: Record<string, unknown>;
  requestId?: string;
  response?: TResponse;
  [key: string]: unknown;
}

/** Raw body returned by `GET /oauth2/api/v1/service`. */
export type RawServiceResponse = Array<
  | { citizen_loginType: number; [key: string]: unknown }
  | { services: Record<string, ServiceResult>; wsdl?: string; [key: string]: unknown }
  | Record<string, unknown>
>;

export interface CitizenData {
  /** `citizen_loginType` as sent by DAN: 1 = digital signature, 0 = SMS OTP. */
  loginType: number | undefined;
  /** All service results, flattened and keyed by service code. */
  services: Record<string, ServiceResult>;
  /** Untouched response body. */
  raw: RawServiceResponse;
}

export interface CallbackParams {
  code?: string | null;
  state?: string | null;
  error?: string | null;
  error_description?: string | null;
}
