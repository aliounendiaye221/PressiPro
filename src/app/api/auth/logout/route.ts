import { cookies } from "next/headers";
import { COOKIE_NAME } from "@/lib/auth";
import { successResponse } from "@/lib/api-utils";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  return successResponse({ ok: true });
}
