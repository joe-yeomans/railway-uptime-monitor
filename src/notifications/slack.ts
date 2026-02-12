import type { AlertPayload, Notifier } from "./types";

export function createSlackNotifier(webhookUrl: string): Notifier {
  return {
    id: "slack",
    async send(payload: AlertPayload): Promise<void> {
      const color = payload.event === "DOWN" ? "#d9392e" : "#2eb886";
      const title = payload.event === "DOWN" ? "Service Down" : "Service Recovered";
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attachments: [
            {
              color,
              title,
              fields: [
                { title: "Service", value: payload.serviceName, short: true },
                { title: "Environment", value: payload.environmentId, short: true },
                { title: "URL", value: payload.url, short: false },
                { title: "Reason", value: payload.reason, short: false }
              ],
              footer: `Latency: ${payload.latencyMs ?? "n/a"}ms | Status: ${payload.statusCode ?? "n/a"}`,
              ts: Math.floor(new Date(payload.timestamp).getTime() / 1000)
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Slack webhook failed (${response.status})`);
      }
    }
  };
}
