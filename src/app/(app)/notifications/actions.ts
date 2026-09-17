"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { emailProvider, sendEmail } from "@/lib/alert-dispatcher";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export async function sendTestEmail() {
  const session = await auth();
  if (session?.user.role !== "ADMIN" || !session.user.email) return;

  let result: string;
  try {
    await sendEmail(
      session.user.email,
      "JASCOMiyaar test email",
      `Email alerts are working. Provider: ${emailProvider()}. Sent ${new Date().toISOString()}.`,
    );
    result = "email=sent";
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Email delivery failed.";
    result = `email=failed&reason=${encodeURIComponent(reason.slice(0, 300))}`;
  }
  redirect(`/notifications?${result}`);
}

export async function markOneRead(id: string) {
  const session = await auth();
  if (!session?.user.id) return;
  await getPrisma().notification.updateMany({
    where: { id, userId: session.user.id },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
}

export async function markAllRead() {
  const session = await auth();
  if (!session?.user.id) return;
  await getPrisma().notification.updateMany({
    where: { userId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
}

export async function dismissOne(id: string) {
  const session = await auth();
  if (!session?.user.id) return;
  await getPrisma().notification.deleteMany({
    where: { id, userId: session.user.id },
  });
  revalidatePath("/notifications");
}

export async function dismissAllRead() {
  const session = await auth();
  if (!session?.user.id) return;
  await getPrisma().notification.deleteMany({
    where: { userId: session.user.id, readAt: { not: null } },
  });
  revalidatePath("/notifications");
}
