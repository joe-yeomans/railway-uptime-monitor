import type { AlertPayload, Notifier } from "./types";

export function createDiscordNotifier(webhookUrl: string): Notifier {
  return {
    id: "discord",
    async send(payload: AlertPayload): Promise<void> {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [
            {
              title: payload.event === "DOWN" ? "Service Down" : "Service Recovered",
              color: payload.event === "DOWN" ? 15158332 : 3066993,
              fields: [
                { name: "Service", value: payload.serviceName, inline: true },
                { name: "Environment", value: payload.environmentId, inline: true },
                { name: "URL", value: payload.url },
                { name: "Reason", value: payload.reason },
                {
                  name: "Diagnostics",
                  value: `status=${payload.statusCode ?? "n/a"}, latency=${payload.latencyMs ?? "n/a"}ms`
                }
              ],
              timestamp: payload.timestamp
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Discord webhook failed (${response.status})`);
      }
    }
  };
}
