import {
  type AppDatabase,
  getMonitorState,
  insertCheckResult,
  listEnabledMonitors,
  openIncident,
  resolveIncident,
  updateMonitorState
} from "../db";
import { logger } from "../logger";
import type { Notifier } from "../notifications/types";
import { runHttpCheck } from "./http-check";

interface EngineDependencies {
  db: AppDatabase;
  notifiers: Notifier[];
}

export async function runMonitoringCycle(deps: EngineDependencies): Promise<void> {
  const monitors = listEnabledMonitors(deps.db);
  if (!monitors.length) {
    logger.warn("No enabled monitors found in database");
    return;
  }

  await Promise.all(
    monitors.map(async (monitor) => {
      const check = await runHttpCheck(monitor);
      insertCheckResult(deps.db, monitor.id, check);

      const state = getMonitorState(deps.db, monitor.id);
      state.lastCheckedAt = check.checkedAt;
      state.lastStatusCode = check.statusCode;
      state.lastLatencyMs = check.latencyMs;
      state.lastError = check.error;

      if (check.outcome === "DOWN") {
        state.consecutiveFailures += 1;
        state.consecutiveSuccesses = 0;

        if (state.currentState !== "DOWN" && state.consecutiveFailures >= monitor.failureThreshold) {
          const incidentId = openIncident(deps.db, monitor.id, check.error ?? "healthcheck failed");
          state.currentState = "DOWN";
          state.openIncidentId = incidentId;
          await notifyAll(deps.notifiers, {
            event: "DOWN",
            monitorId: monitor.id,
            serviceName: monitor.serviceName,
            environmentId: monitor.environmentId,
            url: monitor.url,
            reason: check.error ?? "healthcheck failed",
            statusCode: check.statusCode,
            latencyMs: check.latencyMs,
            timestamp: check.checkedAt
          });
        }
      } else {
        state.consecutiveSuccesses += 1;
        state.consecutiveFailures = 0;

        if (
          state.currentState === "DOWN" &&
          state.openIncidentId &&
          state.consecutiveSuccesses >= monitor.recoveryThreshold
        ) {
          resolveIncident(deps.db, state.openIncidentId, "recovered");
          state.currentState = "UP";
          state.openIncidentId = null;
          await notifyAll(deps.notifiers, {
            event: "RECOVERED",
            monitorId: monitor.id,
            serviceName: monitor.serviceName,
            environmentId: monitor.environmentId,
            url: monitor.url,
            reason: "Service passed health checks",
            statusCode: check.statusCode,
            latencyMs: check.latencyMs,
            timestamp: check.checkedAt
          });
        } else if (state.currentState === "UNKNOWN") {
          state.currentState = "UP";
        }
      }

      updateMonitorState(deps.db, state);
      logger.info("Completed check", {
        monitorId: monitor.id,
        service: monitor.serviceName,
        outcome: check.outcome,
        statusCode: check.statusCode,
        latencyMs: check.latencyMs
      });
    })
  );
}

async function notifyAll(notifiers: Notifier[], payload: Parameters<Notifier["send"]>[0]): Promise<void> {
  await Promise.all(
    notifiers.map(async (notifier) => {
      try {
        await notifier.send(payload);
      } catch (error) {
        logger.error("Notifier delivery failed", {
          notifier: notifier.id,
          error: error instanceof Error ? error.message : String(error),
          event: payload.event,
          monitorId: payload.monitorId
        });
      }
    })
  );
}
