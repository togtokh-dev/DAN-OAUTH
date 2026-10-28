import { describe, expect, it, vi } from "vitest";
import { DanOAuth, DanOAuthError, XYP_WSDL, decodeScope, encodeScope, verifyState } from "../src/index.js";

const opts = {
  clientId: "client-id",
  clientSecret: "secret",
  redirectUri: "https://example.mn/authorized",
};

const groups = [
  { services: ["WS100101_getCitizenIDCardInfo"], wsdl: XYP_WSDL.citizen },
  {
    services: ["WS100201_getPropertyInfo"],
    wsdl: XYP_WSDL.property,
    params: { WS100201_getPropertyInfo: { propertyNumber: "value" } },
  },
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("scope", () => {
  it("round-trips base64(JSON)", () => {
    const s = encodeScope(groups);
    expect(JSON.parse(Buffer.from(s, "base64").toString())).toEqual(groups);
    expect(decodeScope(s)).toEqual(groups);
  });

  it("verifyState", () => {
    expect(verifyState("abc", "abc")).toBe(true);
    expect(verifyState("abc", "abd")).toBe(false);
    expect(verifyState("abc", "abcd")).toBe(false);
    expect(verifyState("abc", null)).toBe(false);
    expect(verifyState("", "")).toBe(false);
  });
});

describe("getAuthorizationUrl", () => {
  it("builds the authorize URL with all params", () => {
    const dan = new DanOAuth(opts);
    const { url, state } = dan.getAuthorizationUrl({ scope: groups, loginType: "signature" });
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe("https://sso.gov.mn/oauth2/authorize");
    expect(u.searchParams.get("response_type")).toBe("code");
    expect(u.searchParams.get("client_id")).toBe("client-id");
    expect(u.searchParams.get("redirect_uri")).toBe(opts.redirectUri);
    expect(u.searchParams.get("scope")).toBe(encodeScope(groups));
    expect(u.searchParams.get("login_type")).toBe("signature");
    expect(state).toMatch(/^[0-9a-f]{64}$/);
    expect(u.searchParams.get("state")).toBe(state);
  });

  it("omits login_type by default and accepts a given state", () => {
    const dan = new DanOAuth({ ...opts, baseUrl: "https://test.sso.gov.mn/" });
    const { url, state } = dan.getAuthorizationUrl({ scope: "abc", state: "s1" });
    const u = new URL(url);
    expect(u.host).toBe("test.sso.gov.mn");
    expect(u.searchParams.has("login_type")).toBe(false);
    expect(state).toBe("s1");
  });

  it("requires credentials", () => {
    expect(() => new DanOAuth({ ...opts, clientSecret: "" })).toThrow(/clientSecret/);
  });
});

describe("validateCallback", () => {
  const dan = new DanOAuth(opts);

  it("accepts objects, URLSearchParams and full URLs", () => {
    expect(dan.validateCallback({ code: "c", state: "s" }, "s")).toBe("c");
    expect(dan.validateCallback(new URLSearchParams("code=c&state=s"), "s")).toBe("c");
    expect(dan.validateCallback("https://example.mn/authorized?code=c%3D&state=s", "s")).toBe("c=");
    expect(dan.validateCallback({ code: ["c"], state: ["s"] } as any, "s")).toBe("c");
  });

  it("rejects state mismatch, missing code and errors", () => {
    const err = (fn: () => unknown) => {
      try {
        fn();
      } catch (e) {
        return (e as DanOAuthError).code;
      }
    };
    expect(err(() => dan.validateCallback({ code: "c", state: "x" }, "s"))).toBe("STATE_MISMATCH");
    expect(err(() => dan.validateCallback({ state: "s" }, "s"))).toBe("MISSING_CODE");
    expect(err(() => dan.validateCallback({ error: "access_denied", state: "s" }, "s"))).toBe("ACCESS_DENIED");
  });
});

describe("server-to-server calls", () => {
  it("runs the full callback flow", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith("/oauth2/token")) {
        expect(init?.method).toBe("POST");
        const body = new URLSearchParams(String(init?.body));
        expect(Object.fromEntries(body)).toEqual({
          grant_type: "authorization_code",
          code: "grant",
          client_id: "client-id",
          client_secret: "secret",
          redirect_uri: opts.redirectUri,
        });
        return json({ access_token: "tok", token_type: "Bearer", expires_in: 60 });
      }
      if (u.endsWith("/oauth2/api/v1/service")) {
        expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
        return json([
          { citizen_loginType: 1 },
          {
            services: { WS100101_getCitizenIDCardInfo: { resultCode: 0, resultMessage: "амжилттай", response: { regnum: "АА00000000" } } },
            wsdl: XYP_WSDL.citizen,
          },
          {
            services: { WS100201_getPropertyInfo: { resultCode: 0, resultMessage: "амжилттай", response: {} } },
            wsdl: XYP_WSDL.property,
          },
        ]);
      }
      throw new Error("unexpected " + u);
    });

    const dan = new DanOAuth({ ...opts, fetch: fetchMock as typeof fetch });
    const data = await dan.handleCallback({ code: "grant", state: "s" }, "s");
    expect(data.loginType).toBe(1);
    expect(data.token.access_token).toBe("tok");
    expect(Object.keys(data.services)).toEqual(["WS100101_getCitizenIDCardInfo", "WS100201_getPropertyInfo"]);
    expect(data.services.WS100101_getCitizenIDCardInfo?.response).toEqual({ regnum: "АА00000000" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces token errors with status and body", async () => {
    const dan = new DanOAuth({
      ...opts,
      fetch: (async () => json({ error: "invalid_grant", error_description: "code expired" }, 400)) as typeof fetch,
    });
    const e = await dan.getAccessToken("x").catch((e) => e);
    expect(e).toBeInstanceOf(DanOAuthError);
    expect(e.code).toBe("TOKEN_REQUEST_FAILED");
    expect(e.status).toBe(400);
    expect(e.message).toContain("code expired");
    expect(e.body).toEqual({ error: "invalid_grant", error_description: "code expired" });
  });

  it("wraps network failures and invalid bodies", async () => {
    const down = new DanOAuth({ ...opts, fetch: (async () => { throw new Error("ECONNRESET"); }) as typeof fetch });
    expect((await down.getAccessToken("x").catch((e) => e)).code).toBe("NETWORK_ERROR");

    const html = new DanOAuth({ ...opts, fetch: (async () => new Response("<html>")) as typeof fetch });
    expect((await html.getServiceResponse("t").catch((e) => e)).code).toBe("INVALID_RESPONSE");
  });
});
