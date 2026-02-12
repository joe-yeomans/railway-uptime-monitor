export type AlertEvent = "DOWN" | "RECOVERED";

export interface AlertPayload {
  event: AlertEvent;
  monitorId: string;
  serviceName: string;
  environmentId: string;
  url: string;
  reason: string;
  statusCode: number | null;
  latencyMs: number | null;
  timestamp: string;
}

export interface Notifier {
  id: string;
  send(payload: AlertPayload): Promise<void>;
}
