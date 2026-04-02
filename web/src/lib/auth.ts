import { cookies } from "next/headers";

export const CUSTOMER_COOKIE = "customer_id";

export async function getCustomerId(): Promise<number | null> {
  const jar = await cookies();
  const raw = jar.get(CUSTOMER_COOKIE)?.value;
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}
