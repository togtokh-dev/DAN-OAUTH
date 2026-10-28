export type DanOAuthErrorCode =
  | "STATE_MISMATCH"
  | "MISSING_CODE"
  | "ACCESS_DENIED"
  | "TOKEN_REQUEST_FAILED"
  | "SERVICE_REQUEST_FAILED"
  | "INVALID_RESPONSE"
  | "NETWORK_ERROR";

export class DanOAuthError extends Error {
  readonly code: DanOAuthErrorCode;
  /** HTTP status of the DAN response, when there was one. */
  readonly status?: number;
  /** Parsed (or raw text) response body, when there was one. */
  readonly body?: unknown;

  constructor(
    code: DanOAuthErrorCode,
    message: string,
    options: { status?: number; body?: unknown; cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "DanOAuthError";
    this.code = code;
    this.status = options.status;
    this.body = options.body;
  }
}
