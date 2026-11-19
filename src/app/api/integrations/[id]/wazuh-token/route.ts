import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { encryptField } from "@/lib/encrypt";
import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { generateWazuhToken, WAZUH_TYPE } from "@/lib/integrations/wazuh";

// Issues a new token for a Wazuh integration. The old token stops working immediately.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole("ADMIN");
  const { id } = await params;
  const prisma = getPrisma();

  const integration = await prisma.integration.findUnique({ where: { id }, select: { id: true, type: true } });
  if (!integration || integration.type !== WAZUH_TYPE) {
    return NextResponse.json({ error: "Wazuh integration not found" }, { status: 404 });
  }

  const token = generateWazuhToken();
  await prisma.integration.update({ where: { id }, data: { clientSecret: encryptField(token) } });
  await audit({ userId: session.user.id, action: "UPDATE", entity: "Integration", entityId: id, detail: { type: WAZUH_TYPE, change: "token regenerated" } });
  return NextResponse.json({ token });
}
