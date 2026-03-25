import { COOKIE_NAME } from "@/lib/auth";
import { successResponse } from "@/lib/api-utils";

export async function POST() {
  const response = successResponse({ ok: true });
  response.cookies.delete(COOKIE_NAME);
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  return response;
}
