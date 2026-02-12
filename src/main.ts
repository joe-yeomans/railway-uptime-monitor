import { loadConfig } from "./config";
import { listEnabledMonitors, openDatabase, runMigrations, upsertMonitors } from "./db";
import { logger } from "./logger";
import { runMonitoringCycle } from "./monitoring/engine";
import { buildNotifiers } from "./notifications";
import { createRailwayClient } from "./railway/client";
import { discoverRailwayServices } from "./railway/discovery";

const args = new Set(Bun.argv.slice(2));

async function main(): Promise<void> {
  const config = loadConfig();
  const db = openDatabase(config.databasePath);
  await runMigrations(db);

  if (args.has("--migrate-only")) {
    logger.info("Migrations complete, exiting due to --migrate-only");
    return;
  }

  const notifiers = buildNotifiers(config);
  logger.info("Notifiers initialized", { count: notifiers.length });

  const railway = createRailwayClient(config.railwayApiToken);

  const refreshMonitors = async (): Promise<void> => {
    const discovered = await discoverRailwayServices(
      railway,
      config.railwayProjectId,
      config.railwayEnvironmentId,
      {
        includeServices: config.serviceIncludeList,
        excludeServices: config.serviceExcludeList
      }
    );

    const monitorInputs = discovered.map((service) => ({
      serviceId: service.serviceId,
      serviceName: service.serviceName,
      projectId: config.railwayProjectId,
      environmentId: config.railwayEnvironmentId,
      url: `http://${service.privateHost}:${service.privatePort}${service.healthcheckPath}`,
      healthcheckPath: service.healthcheckPath,
      intervalSeconds: config.checkIntervalSeconds,
      timeoutMs: config.checkTimeoutMs,
      failureThreshold: config.failureThreshold,
      recoveryThreshold: config.recoveryThreshold,
      expectedStatusMin: config.expectedStatusMin,
      expectedStatusMax: config.expectedStatusMax,
      enabled: true
    }));

    upsertMonitors(db, monitorInputs);
    logger.info("Discovery refresh complete", {
      discoveredServices: discovered.length,
      enabledMonitors: listEnabledMonitors(db).length
    });
  };

  await refreshMonitors();

  const discoveryMs = config.discoveryIntervalSeconds * 1000;
  setInterval(() => {
    refreshMonitors().catch((error) => {
      logger.error("Discovery refresh failed", {
        error: error instanceof Error ? error.message : String(error)
      });
    });
  }, discoveryMs);

  const checkMs = config.checkIntervalSeconds * 1000;
  setInterval(() => {
    runMonitoringCycle({ db, notifiers }).catch((error) => {
      logger.error("Monitoring cycle failed", {
        error: error instanceof Error ? error.message : String(error)
      });
    });
  }, checkMs);

  logger.info("Monitor started", {
    checkIntervalSeconds: config.checkIntervalSeconds,
    discoveryIntervalSeconds: config.discoveryIntervalSeconds
  });
}

main().catch((error) => {
  logger.error("Fatal startup error", {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
});
