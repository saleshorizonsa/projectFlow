/**
 * Wazuh custom integration script, served from the Integrations page.
 *
 * Install on the Wazuh manager as /var/ossec/integrations/custom-masar
 * (owner root:wazuh, mode 750). integratord calls it as:
 *   custom-masar <alert_file> <api_key> <hook_url> [debug]
 * It contains no secrets: the token comes from <api_key> in ossec.conf.
 */
export const WAZUH_SCRIPT_FILENAME = "custom-masar";

export const WAZUH_SCRIPT = String.raw`#!/var/ossec/framework/python/bin/python3
# Masar - Wazuh custom integration.
# Forwards Wazuh alerts (JSON) to Masar over HTTPS. Python 3 standard library only.
# Called by wazuh-integratord: custom-masar <alert_file> <api_key> <hook_url> [debug]

import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.request

LOG_FILE = "/var/ossec/logs/integrations.log"
TIMEOUT_SECONDS = 10
RETRIES = 2

# Wazuh's bundled Python looks for CA certificates under /usr/local/ssl, which usually
# doesn't exist, so every HTTPS request fails with CERTIFICATE_VERIFY_FAILED. Also load
# the operating system's CA bundle. Certificate verification stays on.
SYSTEM_CA_BUNDLES = (
    "/etc/ssl/certs/ca-certificates.crt",  # Debian, Ubuntu
    "/etc/pki/tls/certs/ca-bundle.crt",  # RHEL, CentOS, Rocky, Amazon Linux
    "/etc/ssl/ca-bundle.pem",  # SUSE
    "/etc/ssl/cert.pem",  # Alpine, others
)


def make_ssl_context():
    context = ssl.create_default_context()
    for path in SYSTEM_CA_BUNDLES:
        if os.path.isfile(path):
            try:
                context.load_verify_locations(cafile=path)
                break
            except Exception:
                continue
    return context


SSL_CONTEXT = make_ssl_context()


def log(message):
    line = "%s custom-masar: %s\n" % (time.strftime("%Y/%m/%d %H:%M:%S"), message)
    try:
        with open(LOG_FILE, "a") as handle:
            handle.write(line)
    except Exception:
        sys.stderr.write(line)


def read_alert(path):
    with open(path) as handle:
        text = handle.read().strip()
    try:
        return json.loads(text)
    except ValueError:
        # Some Wazuh versions write one JSON object per line.
        return [json.loads(line) for line in text.splitlines() if line.strip()]


def send(alert, api_key, hook_url):
    body = json.dumps(alert).encode("utf-8")
    request = urllib.request.Request(
        hook_url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer " + api_key,
            "User-Agent": "masar-wazuh-integration/1.0",
        },
    )
    last_error = None
    for attempt in range(RETRIES + 1):
        try:
            with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS, context=SSL_CONTEXT) as response:
                return response.status
        except urllib.error.HTTPError as error:
            # 4xx means the request itself is wrong (bad token, bad data): don't retry.
            if 400 <= error.code < 500:
                raise
            last_error = error
        except Exception as error:
            last_error = error
        time.sleep(1 + attempt)
    raise last_error


def main(argv):
    if len(argv) < 4:
        log("usage: custom-masar <alert_file> <api_key> <hook_url>")
        return 1
    alert_file, api_key, hook_url = argv[1], argv[2], argv[3]
    try:
        alert = read_alert(alert_file)
        status = send(alert, api_key, hook_url)
        if len(argv) > 4 and argv[4] == "debug":
            log("sent alert, HTTP %s" % status)
        return 0
    except urllib.error.HTTPError as error:
        log("Masar rejected the alert: HTTP %s %s" % (error.code, error.reason))
    except Exception as error:
        log("could not send alert to Masar: %s" % error)
    # Never fail loudly: integratord keeps running either way.
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
`;
