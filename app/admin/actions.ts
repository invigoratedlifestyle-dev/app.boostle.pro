"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type TicketStatus = "open" | "in_progress" | "closed";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createClient(url, serviceRoleKey);
}

function isTicketStatus(value: string): value is TicketStatus {
  return value === "open" || value === "in_progress" || value === "closed";
}

export async function bulkUpdateTicketsAction(formData: FormData) {
  const action = String(formData.get("bulkAction") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "/admin");
  const selectedIds = formData
    .getAll("selectedIds")
    .map((value) => String(value))
    .filter(Boolean);

  if (!isTicketStatus(action)) {
    redirect(returnTo);
  }

  if (selectedIds.length === 0) {
    redirect(returnTo);
  }

  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("tickets")
    .update({ status: action })
    .in("id", selectedIds);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin");
  redirect(returnTo);
}