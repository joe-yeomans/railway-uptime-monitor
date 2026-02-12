import type { AlertPayload, Notifier } from "./types";

export function createResendNotifier(
  apiKey: string,
  fromEmail: string,
  toEmail: string,
): Notifier {
  return {
    id: "resend",
    async send(payload: AlertPayload): Promise<void> {
      const subject =
        payload.event === "DOWN"
          ? `[DOWN] ${payload.serviceName} (${payload.environmentId})`
          : `[RECOVERED] ${payload.serviceName} (${payload.environmentId})`;

      const html = `
        <h2>${payload.event === "DOWN" ? "Service Down" : "Service Recovered"}</h2>
        <p><strong>Service:</strong> ${payload.serviceName}</p>
        <p><strong>Environment:</strong> ${payload.environmentId}</p>
        <p><strong>URL:</strong> ${payload.url}</p>
        <p><strong>Reason:</strong> ${payload.reason}</p>
        <p><strong>Status:</strong> ${payload.statusCode ?? "n/a"}</p>
        <p><strong>Latency:</strong> ${payload.latencyMs ?? "n/a"}ms</p>
        <p><strong>Timestamp:</strong> ${payload.timestamp}</p>
      `.trim();

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [toEmail],
          subject,
          html,
        }),
      });

      if (!response.ok) {
        throw new Error(`Resend API failed (${response.status})`);
      }
    },
  };
}
