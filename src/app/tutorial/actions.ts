"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionUser } from "@/services/auth";

// Server action invoked from the tutorial sandbox when the user finishes or
// skips. Runs server-side with the session cookie attached, flips the flag,
// invalidates the dashboard layout's RSC cache, and redirects — no client
// fetch, no client-side router push, no chance for the dashboard to read a
// stale tutorialSeen value.
export async function finishTutorial(skip: boolean) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/");
  }
  await db
    .update(users)
    .set({ tutorialSeen: true, updatedAt: new Date() })
    .where(eq(users.id, session.userId));
  revalidatePath("/dashboard", "layout");
  redirect(skip ? "/dashboard" : "/dashboard/profile");
}
