import { Database } from "bun:sqlite";
import { and, eq, notInArray, sql } from "drizzle-orm";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type {
  CheckOutcome,
  Monitor,
  MonitorState,
  MonitorStatus,
} from "./types";
import type * as schema from "./schema";
import { checkResults, incidents, monitors, monitorState } from "./schema";

export interface AppDatabase {
  client: Database;
  orm: BunSQLiteDatabase<typeof schema>;
}

export function openDatabase(path: string): AppDatabase {
  const client = new Database(path, { create: true, strict: true });
  client.exec("PRAGMA journal_mode = WAL;");
  client.exec("PRAGMA foreign_keys = ON;");

  const orm = drizzle(client, {
    schema: {
      monitors,
      monitorState,
      checkResults,
      incidents,
    },
  });

  return { client, orm };
}

export async function runMigrations(db: AppDatabase): Promise<void> {
  const sqlText = await Bun.file(
    `${process.cwd()}/migrations/0001_init.sql`,
  ).text();
  db.client.exec(sqlText);
}

export function upsertMonitors(
  db: AppDatabase,
  monitorInputs: Array<Omit<Monitor, "id">>,
): void {
  db.orm.transaction((tx) => {
    for (const monitor of monitorInputs) {
      const id = createMonitorId(
        monitor.projectId,
        monitor.environmentId,
        monitor.serviceId,
      );

      tx.insert(monitors)
        .values({
          id,
          serviceId: monitor.serviceId,
          serviceName: monitor.serviceName,
          projectId: monitor.projectId,
          environmentId: monitor.environmentId,
          url: monitor.url,
          healthcheckPath: monitor.healthcheckPath,
          intervalSeconds: monitor.intervalSeconds,
          timeoutMs: monitor.timeoutMs,
          failureThreshold: monitor.failureThreshold,
          recoveryThreshold: monitor.recoveryThreshold,
          expectedStatusMin: monitor.expectedStatusMin,
          expectedStatusMax: monitor.expectedStatusMax,
          enabled: true,
          createdAt: sql`CURRENT_TIMESTAMP`,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .onConflictDoUpdate({
          target: monitors.id,
          set: {
            serviceName: monitor.serviceName,
            url: monitor.url,
            healthcheckPath: monitor.healthcheckPath,
            intervalSeconds: monitor.intervalSeconds,
            timeoutMs: monitor.timeoutMs,
            failureThreshold: monitor.failureThreshold,
            recoveryThreshold: monitor.recoveryThreshold,
            expectedStatusMin: monitor.expectedStatusMin,
            expectedStatusMax: monitor.expectedStatusMax,
            enabled: true,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          },
        })
        .run();

      tx.insert(monitorState)
        .values({
          monitorId: id,
          currentState: "UNKNOWN",
          consecutiveFailures: 0,
          consecutiveSuccesses: 0,
          lastCheckedAt: null,
          lastStatusCode: null,
          lastLatencyMs: null,
          lastError: null,
          openIncidentId: null,
        })
        .onConflictDoNothing()
        .run();
    }

    if (monitorInputs.length > 0) {
      const ids = monitorInputs.map((monitor) =>
        createMonitorId(
          monitor.projectId,
          monitor.environmentId,
          monitor.serviceId,
        ),
      );

      tx.update(monitors)
        .set({ enabled: false, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(
          and(
            eq(monitors.projectId, monitorInputs[0].projectId),
            eq(monitors.environmentId, monitorInputs[0].environmentId),
            notInArray(monitors.id, ids),
          ),
        )
        .run();
    }
  });
}

export function listEnabledMonitors(db: AppDatabase): Monitor[] {
  return db.orm
    .select()
    .from(monitors)
    .where(eq(monitors.enabled, true))
    .all()
    .map((monitor) => ({
      id: monitor.id,
      serviceId: monitor.serviceId,
      serviceName: monitor.serviceName,
      projectId: monitor.projectId,
      environmentId: monitor.environmentId,
      url: monitor.url,
      healthcheckPath: monitor.healthcheckPath,
      intervalSeconds: monitor.intervalSeconds,
      timeoutMs: monitor.timeoutMs,
      failureThreshold: monitor.failureThreshold,
      recoveryThreshold: monitor.recoveryThreshold,
      expectedStatusMin: monitor.expectedStatusMin,
      expectedStatusMax: monitor.expectedStatusMax,
      enabled: monitor.enabled,
    }));
}

export function getMonitorState(
  db: AppDatabase,
  monitorId: string,
): MonitorState {
  const row = db.orm
    .select()
    .from(monitorState)
    .where(eq(monitorState.monitorId, monitorId))
    .get();

  if (!row) {
    throw new Error(`Missing monitor state row for monitor ${monitorId}`);
  }

  return {
    monitorId: row.monitorId,
    currentState: row.currentState as MonitorStatus,
    consecutiveFailures: row.consecutiveFailures,
    consecutiveSuccesses: row.consecutiveSuccesses,
    lastCheckedAt: row.lastCheckedAt,
    lastStatusCode: row.lastStatusCode,
    lastLatencyMs: row.lastLatencyMs,
    lastError: row.lastError,
    openIncidentId: row.openIncidentId,
  };
}

export function insertCheckResult(
  db: AppDatabase,
  monitorId: string,
  check: CheckOutcome,
): string {
  const resultId = crypto.randomUUID();

  db.orm
    .insert(checkResults)
    .values({
      id: resultId,
      monitorId,
      checkedAt: check.checkedAt,
      outcome: check.outcome,
      statusCode: check.statusCode,
      latencyMs: check.latencyMs,
      error: check.error,
    })
    .run();

  return resultId;
}

export function updateMonitorState(db: AppDatabase, state: MonitorState): void {
  db.orm
    .update(monitorState)
    .set({
      currentState: state.currentState,
      consecutiveFailures: state.consecutiveFailures,
      consecutiveSuccesses: state.consecutiveSuccesses,
      lastCheckedAt: state.lastCheckedAt,
      lastStatusCode: state.lastStatusCode,
      lastLatencyMs: state.lastLatencyMs,
      lastError: state.lastError,
      openIncidentId: state.openIncidentId,
    })
    .where(eq(monitorState.monitorId, state.monitorId))
    .run();
}

export function openIncident(
  db: AppDatabase,
  monitorId: string,
  reason: string,
): string {
  const incidentId = crypto.randomUUID();

  db.orm
    .insert(incidents)
    .values({
      id: incidentId,
      monitorId,
      status: "OPEN",
      startedAt: sql`CURRENT_TIMESTAMP`,
      startReason: reason,
    })
    .run();

  return incidentId;
}

export function resolveIncident(
  db: AppDatabase,
  incidentId: string,
  reason: string,
): void {
  db.orm
    .update(incidents)
    .set({
      status: "RESOLVED",
      resolvedAt: sql`CURRENT_TIMESTAMP`,
      resolveReason: reason,
    })
    .where(eq(incidents.id, incidentId))
    .run();
}

function createMonitorId(
  projectId: string,
  environmentId: string,
  serviceId: string,
): string {
  return `${projectId}:${environmentId}:${serviceId}`;
}
