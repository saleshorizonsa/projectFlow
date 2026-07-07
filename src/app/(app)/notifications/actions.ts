"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

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
