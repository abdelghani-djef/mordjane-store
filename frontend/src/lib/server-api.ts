import "server-only";

import { ApiError, withQuery } from "./api";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

/**
 * Server Component fetch straight to FastAPI. Rewrites don't apply server-side, so this uses the
 * absolute backend URL. `no-store` keeps stock and availability live and means `next build`
 * never needs the backend running.
 */
export async function serverApi<T>(
  path: string,
  query?: Record<string, string | number | boolean | null | undefined>,
): Promise<T> {
  const res = await fetch(withQuery(`${BACKEND_URL}/api${path}`, query), { cache: "no-store" });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

/** Like serverApi, but maps a 404 to `null` so pages can call `notFound()`. */
export async function serverApiOrNull<T>(
  path: string,
  query?: Record<string, string | number | boolean | null | undefined>,
): Promise<T | null> {
  try {
    return await serverApi<T>(path, query);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
