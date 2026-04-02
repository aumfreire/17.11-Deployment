"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CUSTOMER_COOKIE } from "@/lib/auth";

export async function selectCustomerAction(formData: FormData) {
  const raw = String(formData.get("customer_id") ?? "");
  const id = parseInt(raw, 10);
  if (!Number.isFinite(id)) {
    return;
  }
  const jar = await cookies();
  jar.set(CUSTOMER_COOKIE, String(id), {
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
    sameSite: "lax",
  });
  redirect("/dashboard");
}
