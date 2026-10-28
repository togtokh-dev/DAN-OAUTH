# dan-oauth

[ДАН](https://sso.gov.mn) — Төрийн нэгдсэн нэвтрэлтийн системийн OAuth 2.0 Node.js клиент.
Иргэнийг ДАН-аар нэвтрүүлж, ХУР төрийн мэдээлэл солилцооны системийн сервисүүдээс (иргэний үнэмлэх, үл хөдлөх хөрөнгө, тээврийн хэрэгсэл, НДШ, татвар …) мэдээлэл авна.

- Runtime dependency байхгүй, Node.js ≥ 18 (`fetch` ашиглана)
- TypeScript төрлүүдтэй, ESM + CommonJS
- `state` (CSRF) үүсгэх, constant-time шалгах
- Алдааг `DanOAuthError` (`code`, `status`, `body`) хэлбэрээр буцаана

Албан ёсны баримт бичиг: <https://developer.sso.gov.mn/docs/intro>

## Суулгах

```bash
npm install dan-oauth
```

## Урьдчилсан шаардлага

Үндэсний Дата Төвөөс дараах мэдээллийг авсан байх ([холбогдох дараалал](https://developer.sso.gov.mn/docs/category/системд-холбогдох)):

| Утга | Тайлбар |
| --- | --- |
| `Client ID` | Таны системийг таних ID |
| `Client Secret Key` | **Нууц.** Зөвхөн сервер талд хадгална |
| `Redirect URI` | ДАН хариуг буцаах хаяг |

Мөн ХУР системд холбогдсон, олон улсад итгэмжлэгдсэн SSL гэрчилгээтэй байх шаардлагатай.

## Ашиглах (Express жишээ)

```ts
import express from "express";
import session from "express-session";
import { DanOAuth, DanOAuthError, XYP_WSDL } from "dan-oauth";

const dan = new DanOAuth({
  clientId: process.env.DAN_CLIENT_ID!,
  clientSecret: process.env.DAN_CLIENT_SECRET!,
  redirectUri: "https://example.mn/auth/dan/callback",
});

const app = express();
app.use(session({ secret: process.env.SESSION_SECRET!, resave: false, saveUninitialized: false }));

// 1. Иргэнийг ДАН руу чиглүүлэх
app.get("/auth/dan", (req, res) => {
  const { url, state } = dan.getAuthorizationUrl({
    scope: [
      { services: ["WS100101_getCitizenIDCardInfo"], wsdl: XYP_WSDL.citizen },
    ],
    loginType: "OTP", // "OTP" | "signature" | "bank" — заавал биш
  });
  req.session.danState = state;
  res.redirect(url);
});

// 2. Буцаалт: state шалгах → token авах → иргэний мэдээлэл авах
app.get("/auth/dan/callback", async (req, res) => {
  const expected = req.session.danState;
  delete req.session.danState; // state нэг удаагийн
  try {
    const { loginType, services } = await dan.handleCallback(req.query, expected);
    const idCard = services.WS100101_getCitizenIDCardInfo;
    if (idCard?.resultCode !== 0) throw new Error(idCard?.resultMessage);
    res.json({ loginType, citizen: idCard.response });
  } catch (e) {
    if (e instanceof DanOAuthError) {
      return res.status(e.code === "STATE_MISMATCH" ? 403 : 502).json({ code: e.code, message: e.message });
    }
    throw e;
  }
});
```

### Оролтын параметртэй сервис

```ts
dan.getAuthorizationUrl({
  scope: [
    {
      services: ["WS100201_getPropertyInfo"],
      wsdl: XYP_WSDL.property,
      params: { WS100201_getPropertyInfo: { propertyNumber: "Ү2204012345" } },
    },
  ],
});
```

Нэг хүсэлтэд олон бүлэг (WSDL) сервис зэрэг оруулж болно. Сервисийн WSDL хаяг, параметрийг ХУР системийн гарын авлагаас авна. `DAN_SERVICES`-д ДАН-аар дуудах боломжтой сервисийн кодууд тайлбартайгаа бий.

### Алхам алхмаар

`handleCallback` нь дараах функцуудыг дарааллаар нь дууддаг. Шаардлагатай бол тус тусад нь ашиглаж болно.

```ts
const code = dan.validateCallback(req.query, expectedState); // STATE_MISMATCH | MISSING_CODE | ACCESS_DENIED
const token = await dan.getAccessToken(code);                 // POST /oauth2/token
const data = await dan.getCitizenData(token.access_token);    // GET  /oauth2/api/v1/service
// эсвэл боловсруулаагүй хариу: await dan.getServiceResponse(token.access_token)
```

> ⚠️ Access token нэг удаагийн бөгөөд ойролцоогоор 60 секунд хүчинтэй. Token авсны дараа шууд сервисээ дуудна уу.

## API

### `new DanOAuth(options)`

| Option | Default | |
| --- | --- | --- |
| `clientId` | — | заавал |
| `clientSecret` | — | заавал |
| `redirectUri` | — | заавал |
| `baseUrl` | `https://sso.gov.mn` | |
| `timeoutMs` | `15000` | сервер хоорондын хүсэлтийн хугацаа |
| `fetch` | `globalThis.fetch` | proxy, тест зэрэгт |

### Буцаах өгөгдөл — `CitizenData`

```ts
{
  loginType: number | undefined;            // citizen_loginType: 1 = тоон гарын үсэг, 0 = SMS OTP
  services: Record<string, ServiceResult>;  // сервисийн кодоор нь хавтгайрууллан
  raw: RawServiceResponse;                  // ДАН-ий анхны хариу
}
```

`ServiceResult`: `{ resultCode, resultMessage, request, requestId, response }` — `resultCode === 0` бол амжилттай.

### Туслах функцууд

- `encodeScope(groups)` / `decodeScope(scope)` — `base64(JSON)` scope
- `generateState()` / `verifyState(expected, received)`
- `parseServiceResponse(raw)`

### `DanOAuthError.code`

`STATE_MISMATCH`, `MISSING_CODE`, `ACCESS_DENIED`, `TOKEN_REQUEST_FAILED`, `SERVICE_REQUEST_FAILED`, `INVALID_RESPONSE`, `NETWORK_ERROR`

## License

MIT
