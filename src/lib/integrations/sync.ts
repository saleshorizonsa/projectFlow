// Provider-agnostic sync dispatcher shared by the manual sync route and the cron.
// Each provider's sync function returns the same SyncResult shape.

import { decryptField } from "@/lib/encrypt";
import { syncO365, type O365Config } from "@/lib/integrations/o365";
import { syncSophos, type SophosConfig } from "@/lib/integrations/sophos";

export type SyncResult = {
  eventsIngested: number;
  contentUrisFetched: number;
  errors: string[];
};

/** The full Integration record (including the encrypted clientSecret) this needs. */
export type IntegrationForSync = {
  id: string;
  type: string;
  name: string;
  tenantId: string | null;
  clientId: string | null;
  clientSecret: string | null;
  config: unknown;
  lastSyncAt: Date | null;
};

/** Provider types that support automated sync. */
export const SYNCABLE_TYPES = ["O365", "SOPHOS"] as const;

export async function runIntegrationSync(integration: IntegrationForSync): Promise<SyncResult> {
  if (!integration.clientSecret) {
    throw new Error("Integration is missing credentials. Please configure it first.");
  }
  const secret = decryptField(integration.clientSecret);

  switch (integration.type) {
    case "O365": {
      if (!integration.tenantId || !integration.clientId) {
        throw new Error("Microsoft 365 requires tenant ID and client ID.");
      }
      const config = (integration.config ?? { contentTypes: ["Audit.AzureActiveDirectory"] }) as O365Config;
      return syncO365(integration.tenantId, integration.clientId, secret, config, integration.lastSyncAt);
    }
    case "SOPHOS": {
      if (!integration.clientId) {
        throw new Error("Sophos Central requires an API client ID.");
      }
      const config = (integration.config ?? {}) as SophosConfig;
      return syncSophos(integration.clientId, secret, config, integration.lastSyncAt);
    }
    default:
      throw new Error(`Sync not implemented for type: ${integration.type}`);
  }
}
