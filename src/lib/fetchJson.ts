/**
 * fetch() wrapped with a JSON parse that can never throw a raw, cryptic
 * native error (like Safari/WebKit's "The string did not match the
 * expected pattern." when `res.json()` is called on a non-JSON body).
 *
 * Any API route in this app can end up returning something that isn't the
 * `{ ok, ... }` JSON shape it normally returns - most notably Vercel's own
 * platform-level 413 page when a request body exceeds its hard 4.5MB
 * serverless function limit, but also things like an auth-gateway HTML
 * page or a cold-start timeout. Calling `.json()` on those directly throws
 * a native SyntaxError whose message is meaningless to an end user (and,
 * on Safari specifically, is the unhelpful generic string this was built
 * to fix). This wrapper always throws a `FetchJsonError` with a friendly
 * Thai message instead, so callers can show it directly in a popup.
 */
export class FetchJsonError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'FetchJsonError';
    this.status = status;
  }
}

/**
 * CSRF protection (Authentication Platform v3.0, spec section 10): a
 * simple cross-site `<form>` POST can ride along on the `mqr_session`
 * cookie (`sameSite: 'lax'` alone doesn't block a top-level cross-site
 * navigation), but it can't attach a custom header - only same-origin
 * `fetch`/XHR can, and a cross-origin one would need a CORS preflight
 * this app never allows. `middleware.ts` rejects any mutating `/api/*`
 * request missing this header. The one call site that bypasses `fetchJson`
 * (logout) sets it directly - see `middleware.ts` for the enforcement
 * side.
 */
export const CSRF_HEADER = 'x-mqr-csrf';
export const CSRF_HEADER_VALUE = '1';

export async function fetchJson<T = any>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { ...init?.headers, [CSRF_HEADER]: CSRF_HEADER_VALUE } });
  } catch {
    throw new FetchJsonError('เชื่อมต่อเครือข่ายไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง');
  }

  if (res.status === 413) {
    throw new FetchJsonError('ไฟล์มีขนาดใหญ่เกินไปสำหรับระบบ กรุณาลองไฟล์ที่เล็กลง', 413);
  }

  const text = await res.text();
  let json: any;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new FetchJsonError(
      `เซิร์ฟเวอร์ตอบกลับข้อมูลไม่ถูกต้อง (${res.status}) กรุณาลองใหม่อีกครั้ง`,
      res.status
    );
  }

  // Routes answer errors either as a plain string in `json.error`, or as
  // `{ code, message }` (the structured convention most routes are being
  // migrated to, `src/lib/apiError.ts`) - support both shapes so callers
  // always get a displayable string rather than the object itself
  // stringifying to "[object Object]".
  const errorCode = json?.error && typeof json.error === 'object' ? json.error.code : undefined;
  const errorMessage =
    typeof json?.error === 'string'
      ? json.error
      : typeof json?.error?.message === 'string'
        ? json.error.message
        : undefined;

  // Every session-gated API route in this app answers a missing/expired
  // login cookie with the generic shape `{ ok:false, error:'unauthorized' }`
  // (or, for PM Record routes, `{ error: { code: 'UNAUTHORIZED', ... } }`)
  // and status 401 - that case gets the friendly "please log in again"
  // popup. But /api/auth/login itself also responds with its own 401 for
  // an everyday wrong username/password, carrying a specific, already
  // user-facing Thai message in `json.error`. That message must reach the
  // caller as-is instead of being overwritten with "session expired".
  if (res.status === 401 && (!json?.error || json.error === 'unauthorized' || errorCode === 'UNAUTHORIZED')) {
    throw new FetchJsonError('SESSION_EXPIRED', 401);
  }

  if (!res.ok && json?.ok !== true) {
    throw new FetchJsonError(errorMessage || `เกิดข้อผิดพลาด (${res.status})`, res.status);
  }

  return json as T;
}
