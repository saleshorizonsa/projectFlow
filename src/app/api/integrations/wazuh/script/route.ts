import { requireRole } from "@/lib/permissions";
import { WAZUH_SCRIPT, WAZUH_SCRIPT_FILENAME } from "@/lib/integrations/wazuh-script";

// Downloads the Wazuh integration script (contains no secrets).
export async function GET() {
  await requireRole("ADMIN");
  // Always LF: a CRLF shebang line would stop the script running on Linux.
  return new Response(WAZUH_SCRIPT.replace(/\r\n/g, "\n"), {
    headers: {
      "Content-Type": "text/x-python; charset=utf-8",
      "Content-Disposition": `attachment; filename="${WAZUH_SCRIPT_FILENAME}"`,
      "Cache-Control": "no-store",
    },
  });
}
