import type { AlertPayload, Notifier } from "./types";

export function createTelegramNotifier(botToken: string, chatId: string): Notifier {
  return {
    id: "telegram",
    async send(payload: AlertPayload): Promise<void> {
      const text = [
        payload.event === "DOWN" ? "🚨 Service Down" : "✅ Service Recovered",
        `Service: ${payload.serviceName}`,
        `Environment: ${payload.environmentId}`,
        `URL: ${payload.url}`,
        `Reason: ${payload.reason}`,
        `Status: ${payload.statusCode ?? "n/a"}`,
        `Latency: ${payload.latencyMs ?? "n/a"}ms`
      ].join("\n");

      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text
        })
      });

      if (!response.ok) {
        throw new Error(`Telegram API failed (${response.status})`);
      }
    }
  };
}
