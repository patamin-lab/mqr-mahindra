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

export async function fetchJson<T = any>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new FetchJsonError('เชื่อมต่อเครือข่ายไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง');
  }

  if (res.status === 401) {
    throw new FetchJsonError('SESSION_EXPIRED', 401);
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

  if (!res.ok && json?.ok !== true) {
    throw new FetchJsonError(json?.error || `เกิดข้อผิดพลาด (${res.status})`, res.status);
  }

  return json as T;
}
