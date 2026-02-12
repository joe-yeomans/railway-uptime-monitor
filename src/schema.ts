import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const monitors = sqliteTable("monitors", {
  id: text("id").primaryKey(),
  serviceId: text("service_id").notNull(),
  serviceName: text("service_name").notNull(),
  projectId: text("project_id").notNull(),
  environmentId: text("environment_id").notNull(),
  url: text("url").notNull(),
  healthcheckPath: text("healthcheck_path").notNull(),
  intervalSeconds: integer("interval_seconds").notNull(),
  timeoutMs: integer("timeout_ms").notNull(),
  failureThreshold: integer("failure_threshold").notNull(),
  recoveryThreshold: integer("recovery_threshold").notNull(),
  expectedStatusMin: integer("expected_status_min").notNull(),
  expectedStatusMax: integer("expected_status_max").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const monitorState = sqliteTable("monitor_state", {
  monitorId: text("monitor_id").primaryKey(),
  currentState: text("current_state").notNull(),
  consecutiveFailures: integer("consecutive_failures").notNull(),
  consecutiveSuccesses: integer("consecutive_successes").notNull(),
  lastCheckedAt: text("last_checked_at"),
  lastStatusCode: integer("last_status_code"),
  lastLatencyMs: integer("last_latency_ms"),
  lastError: text("last_error"),
  openIncidentId: text("open_incident_id")
});

export const checkResults = sqliteTable("check_results", {
  id: text("id").primaryKey(),
  monitorId: text("monitor_id").notNull(),
  checkedAt: text("checked_at").notNull(),
  outcome: text("outcome").notNull(),
  statusCode: integer("status_code"),
  latencyMs: integer("latency_ms"),
  error: text("error")
});

export const incidents = sqliteTable("incidents", {
  id: text("id").primaryKey(),
  monitorId: text("monitor_id").notNull(),
  status: text("status").notNull(),
  startedAt: text("started_at").notNull(),
  resolvedAt: text("resolved_at"),
  startReason: text("start_reason").notNull(),
  resolveReason: text("resolve_reason")
});
