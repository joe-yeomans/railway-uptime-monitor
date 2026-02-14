import { loadConfig } from "./config";
import type { AppConfig } from "./config";
import {
  listEnabledMonitors,
  openDatabase,
  runMigrations,
  upsertMonitors,
} from "./db";
import { logger } from "./logger";
import { runMonitoringCycle } from "./monitoring/engine";
import { buildNotifiers } from "./notifications";
import { createRailwayClient } from "./railway/client";
import { discoverRailwayServices } from "./railway/discovery";
import type { DiscoveredRailwayService } from "./types";

const args = new Set(Bun.argv.slice(2));

async function main(): Promise<void> {
  const config = loadConfig();
  const startedAt = Date.now();
  const healthServer = Bun.serve({
    port: config.healthPort,
    fetch(request: Request) {
      const { pathname } = new URL(request.url);
      if (request.method === "GET" && pathname === config.healthcheckPath) {
        const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000);
        return Response.json({
          status: "ok",
          uptimeSeconds,
        });
      }

      return new Response("Not Found", { status: 404 });
    },
  });

  logger.info("Healthcheck server listening", {
    port: healthServer.port,
    path: config.healthcheckPath,
  });

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
        excludeServices: config.serviceExcludeList,
      },
    );
    const targetServices = discovered.filter((service) =>
      shouldMonitorService(service, config),
    );

    const monitorInputs = targetServices
      .map((service) => {
        const url = resolveMonitorUrl(service);
        if (!url) {
          logger.warn("Skipping service due to unavailable public URL", {
            service: service.serviceName,
          });
          return null;
        }

        return {
          serviceId: service.serviceId,
          serviceName: service.serviceName,
          projectId: config.railwayProjectId,
          environmentId: config.railwayEnvironmentId,
          url,
          healthcheckPath: service.healthcheckPath,
          intervalSeconds: config.checkIntervalSeconds,
          timeoutMs: config.checkTimeoutMs,
          failureThreshold: config.failureThreshold,
          recoveryThreshold: config.recoveryThreshold,
          expectedStatusMin: config.expectedStatusMin,
          expectedStatusMax: config.expectedStatusMax,
          enabled: true,
        };
      })
      .filter(
        (monitor): monitor is NonNullable<typeof monitor> => monitor !== null,
      );

    for (const monitor of monitorInputs) {
      logger.info("Configured monitor target", {
        service: monitor.serviceName,
        url: monitor.url,
      });
    }

    upsertMonitors(db, monitorInputs);
    logger.info("Discovery refresh complete", {
      discoveredServices: discovered.length,
      skippedSelfServices: discovered.length - targetServices.length,
      enabledMonitors: listEnabledMonitors(db).length,
    });
  };

  await refreshMonitors();

  const discoveryMs = config.discoveryIntervalSeconds * 1000;
  setInterval(() => {
    refreshMonitors().catch((error) => {
      logger.error("Discovery refresh failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, discoveryMs);

  const checkMs = config.checkIntervalSeconds * 1000;
  setInterval(() => {
    runMonitoringCycle({ db, notifiers }).catch((error) => {
      logger.error("Monitoring cycle failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, checkMs);

  logger.info("Monitor started", {
    checkIntervalSeconds: config.checkIntervalSeconds,
    discoveryIntervalSeconds: config.discoveryIntervalSeconds,
    healthcheckPath: config.healthcheckPath,
    healthPort: healthServer.port,
  });
}

function resolveMonitorUrl(service: DiscoveredRailwayService): string | null {
  return service.publicHost
    ? `https://${service.publicHost}${service.healthcheckPath}`
    : null;
}

function shouldMonitorService(
  service: DiscoveredRailwayService,
  config: AppConfig,
): boolean {
  if (
    config.railwayServiceId &&
    service.serviceId === config.railwayServiceId
  ) {
    logger.info("Skipping self service by id", {
      service: service.serviceName,
      serviceId: service.serviceId,
    });
    return false;
  }

  if (
    config.railwayServiceName &&
    service.serviceName.toLowerCase() ===
      config.railwayServiceName.toLowerCase()
  ) {
    logger.info("Skipping self service by name", {
      service: service.serviceName,
      serviceId: service.serviceId,
    });
    return false;
  }

  return true;
}

main().catch((error) => {
  logger.error("Fatal startup error", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
