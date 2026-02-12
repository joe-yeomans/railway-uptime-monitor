export type MonitorStatus = "UP" | "DOWN" | "UNKNOWN";
export type IncidentStatus = "OPEN" | "RESOLVED";

export interface Monitor {
  id: string;
  serviceId: string;
  serviceName: string;
  projectId: string;
  environmentId: string;
  url: string;
  healthcheckPath: string;
  intervalSeconds: number;
  timeoutMs: number;
  failureThreshold: number;
  recoveryThreshold: number;
  expectedStatusMin: number;
  expectedStatusMax: number;
  enabled: boolean;
}

export interface MonitorState {
  monitorId: string;
  currentState: MonitorStatus;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastCheckedAt: string | null;
  lastStatusCode: number | null;
  lastLatencyMs: number | null;
  lastError: string | null;
  openIncidentId: string | null;
}

export interface CheckOutcome {
  outcome: "UP" | "DOWN";
  checkedAt: string;
  statusCode: number | null;
  latencyMs: number | null;
  error: string | null;
}

export interface DiscoveredRailwayService {
  serviceId: string;
  serviceName: string;
  healthcheckPath: string;
  privateHost: string | null;
  privatePort: number | null;
  publicHost: string | null;
}

export interface DiscoveryFilter {
  includeServices?: string[];
  excludeServices?: string[];
}
