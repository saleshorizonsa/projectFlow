// Browser-safe setup snippets for the Wazuh integration (shown on the Integrations page).

export function wazuhHookUrl(origin: string, integrationId: string) {
  return `${origin}/api/wazuh/${integrationId}/alerts`;
}

/** Main block: forwards every alert at or above minLevel. */
export function wazuhOssecConfBlock(hookUrl: string, token: string, minLevel: number): string {
  return [
    "<integration>",
    "  <name>custom-masar</name>",
    `  <hook_url>${hookUrl}</hook_url>`,
    `  <api_key>${token}</api_key>`,
    `  <level>${minLevel}</level>`,
    "  <alert_format>json</alert_format>",
    "</integration>",
  ].join("\n");
}

/** Second block so low-level vulnerability alerts (including "solved" notices) also reach Masar. */
export function wazuhOssecConfVulnBlock(hookUrl: string, token: string): string {
  return [
    "<integration>",
    "  <name>custom-masar</name>",
    `  <hook_url>${hookUrl}</hook_url>`,
    `  <api_key>${token}</api_key>`,
    "  <group>vulnerability-detector</group>",
    "  <alert_format>json</alert_format>",
    "</integration>",
  ].join("\n");
}

export const WAZUH_INSTALL_COMMANDS = [
  "# On the Wazuh manager, as root:",
  "sudo cp custom-masar /var/ossec/integrations/custom-masar",
  "sudo chown root:wazuh /var/ossec/integrations/custom-masar",
  "sudo chmod 750 /var/ossec/integrations/custom-masar",
  "# Add the <integration> block(s) inside <ossec_config> in /var/ossec/etc/ossec.conf, then:",
  "sudo systemctl restart wazuh-manager",
  "# Check for errors:",
  "sudo tail -f /var/ossec/logs/integrations.log /var/ossec/logs/ossec.log",
].join("\n");

export const WAZUH_LEVELS = [
  { value: 3, label: "3 — everything worth logging (noisy)" },
  { value: 5, label: "5 — include low-severity events" },
  { value: 7, label: "7 — medium and above (recommended)" },
  { value: 10, label: "10 — high and critical only" },
  { value: 12, label: "12 — critical only" },
];
