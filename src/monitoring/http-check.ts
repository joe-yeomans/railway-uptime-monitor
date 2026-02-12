import type { CheckOutcome, Monitor } from "../types";

export async function runHttpCheck(monitor: Monitor): Promise<CheckOutcome> {
  const start = performance.now();
  const checkedAt = new Date().toISOString();

  try {
    const response = await fetch(monitor.url, {
      method: "GET",
      signal: AbortSignal.timeout(monitor.timeoutMs),
    });

    const latencyMs = Math.round(performance.now() - start);
    const isUp =
      response.status >= monitor.expectedStatusMin &&
      response.status <= monitor.expectedStatusMax;

    return {
      outcome: isUp ? "UP" : "DOWN",
      checkedAt,
      statusCode: response.status,
      latencyMs,
      error: isUp ? null : `Unexpected status: ${response.status}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      outcome: "DOWN",
      checkedAt,
      statusCode: null,
      latencyMs: Math.round(performance.now() - start),
      error: message,
    };
  }
}
