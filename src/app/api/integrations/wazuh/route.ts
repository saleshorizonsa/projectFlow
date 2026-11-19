import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { encryptField } from "@/lib/encrypt";
import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { generateWazuhToken, normalizeWazuhConfig, WAZUH_TYPE } from "@/lib/integrations/wazuh";

// Creates a Wazuh integration. The token is generated here and returned ONCE;
// only its encrypted form is stored.
export async function POST(request: Request) {
  const session = await requireRole("ADMIN");
  const body = (await request.json().catch(() => null)) as { name?: string; minLevel?: number; importVulnerabilities?: boolean } | null;
  const name = body?.name?.trim() || "Wazuh SIEM";

  const token = generateWazuhToken();
  const integration = await getPrisma().integration.create({
    data: {
      type: WAZUH_TYPE,
      name,
      enabled: true,
      clientSecret: encryptField(token),
      config: normalizeWazuhConfig(body),
    },
    select: { id: true, type: true, name: true },
  });

  await audit({ userId: session.user.id, action: "CREATE", entity: "Integration", entityId: integration.id, detail: { type: WAZUH_TYPE, name } });
  return NextResponse.json({ integration, token }, { status: 201 });
}
