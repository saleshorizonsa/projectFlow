"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export async function updateEmployeeStatus(employeeId: string, status: string) {
  const session = await auth();
  if (!session?.user.id || !["ADMIN", "PROJECT_MANAGER"].includes(session.user.role)) return;
  await getPrisma().employee.update({
    where: { id: employeeId },
    data: { status: status as "ACTIVE" | "ON_LEAVE" | "EXITED", updatedBy: session.user.id },
  });
  revalidatePath(`/employees/${employeeId}`);
}
