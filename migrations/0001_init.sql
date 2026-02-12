CREATE TABLE IF NOT EXISTS monitors (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL,
  service_name TEXT NOT NULL,
  project_id TEXT NOT NULL,
  environment_id TEXT NOT NULL,
  url TEXT NOT NULL,
  healthcheck_path TEXT NOT NULL,
  interval_seconds INTEGER NOT NULL,
  timeout_ms INTEGER NOT NULL,
  failure_threshold INTEGER NOT NULL,
  recovery_threshold INTEGER NOT NULL,
  expected_status_min INTEGER NOT NULL,
  expected_status_max INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS monitors_unique_service
  ON monitors (project_id, environment_id, service_id);

CREATE TABLE IF NOT EXISTS monitor_state (
  monitor_id TEXT PRIMARY KEY REFERENCES monitors(id) ON DELETE CASCADE,
  current_state TEXT NOT NULL CHECK(current_state IN ('UP', 'DOWN', 'UNKNOWN')),
  consecutive_failures INTEGER NOT NULL,
  consecutive_successes INTEGER NOT NULL,
  last_checked_at TEXT,
  last_status_code INTEGER,
  last_latency_ms INTEGER,
  last_error TEXT,
  open_incident_id TEXT
);

CREATE TABLE IF NOT EXISTS check_results (
  id TEXT PRIMARY KEY,
  monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  checked_at TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK(outcome IN ('UP', 'DOWN')),
  status_code INTEGER,
  latency_ms INTEGER,
  error TEXT
);

CREATE INDEX IF NOT EXISTS check_results_monitor_checked_idx
  ON check_results (monitor_id, checked_at DESC);

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('OPEN', 'RESOLVED')),
  started_at TEXT NOT NULL,
  resolved_at TEXT,
  start_reason TEXT NOT NULL,
  resolve_reason TEXT
);

CREATE INDEX IF NOT EXISTS incidents_monitor_status_idx
  ON incidents (monitor_id, status, started_at DESC);

CREATE TABLE IF NOT EXISTS notification_channels (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('SLACK', 'DISCORD', 'TELEGRAM', 'RESEND')),
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  config_encrypted TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_rules (
  id TEXT PRIMARY KEY,
  monitor_id TEXT REFERENCES monitors(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL REFERENCES notification_channels(id) ON DELETE CASCADE,
  on_down INTEGER NOT NULL DEFAULT 1,
  on_recovered INTEGER NOT NULL DEFAULT 1,
  on_flapping INTEGER NOT NULL DEFAULT 0,
  cooldown_seconds INTEGER NOT NULL DEFAULT 60,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_outbox (
  id TEXT PRIMARY KEY,
  incident_id TEXT REFERENCES incidents(id) ON DELETE CASCADE,
  monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  channel_id TEXT REFERENCES notification_channels(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('DOWN', 'RECOVERED', 'FLAPPING')),
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PENDING', 'SENT', 'FAILED')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT
);

CREATE INDEX IF NOT EXISTS notification_outbox_status_next_attempt_idx
  ON notification_outbox (status, next_attempt_at);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id TEXT PRIMARY KEY,
  outbox_id TEXT NOT NULL REFERENCES notification_outbox(id) ON DELETE CASCADE,
  attempted_at TEXT NOT NULL,
  success INTEGER NOT NULL,
  provider_message_id TEXT,
  error TEXT,
  http_status INTEGER
);

CREATE TABLE IF NOT EXISTS service_discovery_cache (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  environment_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  service_name TEXT NOT NULL,
  healthcheck_path TEXT NOT NULL,
  private_host TEXT NOT NULL,
  private_port INTEGER NOT NULL,
  last_seen_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS discovery_cache_scope_idx
  ON service_discovery_cache (project_id, environment_id, service_id);
