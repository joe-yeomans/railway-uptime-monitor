import type { DiscoveryFilter, DiscoveredRailwayService } from "../types";
import type { RailwayGraphQLClient } from "./client";

const DISCOVERY_QUERY = `
query DiscoverServices($projectId: String!) {
  project(id: $projectId) {
    environments {
      edges {
        node {
          id
          serviceInstances {
            edges {
              node {
                id
                serviceId
                serviceName
                service {
                  id
                  name
                }
                cronSchedule
                healthcheckPath
                domains {
                  serviceDomains {
                    domain
                    suffix
                    targetPort
                  }
                  customDomains {
                    domain
                    targetPort
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
`;

interface DiscoveryQueryResult {
  project: {
    environments: {
      edges: Array<{
        node: {
          id: string;
          serviceInstances: {
            edges: Array<{
              node: {
                id: string;
                serviceId?: string;
                serviceName?: string;
                service?: { id?: string; name?: string };
                cronSchedule?: string | null;
                healthcheckPath?: string | null;
                domains?: {
                  serviceDomains?: Array<{
                    domain?: string | null;
                    suffix?: string | null;
                    targetPort?: number | null;
                  }>;
                  customDomains?: Array<{
                    domain?: string | null;
                    targetPort?: number | null;
                  }>;
                } | null;
              };
            }>;
          };
        };
      }>;
    };
  };
}

export async function discoverRailwayServices(
  client: RailwayGraphQLClient,
  projectId: string,
  environmentId: string,
  filter: DiscoveryFilter,
): Promise<DiscoveredRailwayService[]> {
  const data = await client.query<DiscoveryQueryResult>(DISCOVERY_QUERY, {
    projectId,
  });

  const environment = data.project.environments.edges.find(
    (edge) => edge.node.id === environmentId,
  )?.node;
  if (!environment) {
    throw new Error(
      `Could not find environment ${environmentId} in project ${projectId}`,
    );
  }

  const includeSet = new Set(filter.includeServices ?? []);
  const excludeSet = new Set(filter.excludeServices ?? []);

  const discovered = environment.serviceInstances.edges
    .map((edge) => edge.node)
    .map((instance) => {
      const serviceId = instance.serviceId ?? instance.service?.id;
      const serviceName = instance.serviceName ?? instance.service?.name;
      const hasCronSchedule = Boolean(
        instance.cronSchedule && instance.cronSchedule.trim().length > 0,
      );
      const healthcheckPath = normalizePath(instance.healthcheckPath ?? null);
      const serviceDomains = instance.domains?.serviceDomains ?? [];
      const customDomains = instance.domains?.customDomains ?? [];
      const privateDomain = selectPrivateServiceDomain(serviceDomains);
      const publicDomain = selectPublicDomain(serviceDomains, customDomains);
      const privateHost =
        privateDomain?.domain ??
        (serviceName ? `${serviceName}.railway.internal` : null);
      const privatePort = privateHost
        ? (privateDomain?.targetPort ?? 80)
        : null;

      if (hasCronSchedule) return null;
      if (!serviceId || !serviceName || !healthcheckPath) return null;

      return {
        serviceId,
        serviceName,
        healthcheckPath,
        privateHost,
        privatePort,
        publicHost: publicDomain?.domain ?? null,
      } satisfies DiscoveredRailwayService;
    });

  return discovered
    .filter((service): service is DiscoveredRailwayService => service !== null)
    .filter((service) =>
      includeSet.size ? includeSet.has(service.serviceName) : true,
    )
    .filter((service) => !excludeSet.has(service.serviceName));
}

function normalizePath(path: string | null): string | null {
  if (!path) return null;
  const normalized = path.trim();
  if (!normalized || normalized.includes("://")) return null;
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function selectPrivateServiceDomain(
  domains: Array<{
    domain?: string | null;
    suffix?: string | null;
    targetPort?: number | null;
  }>,
): { domain: string; targetPort: number | null } | null {
  const privateMatch =
    domains.find((domain) =>
      (domain.suffix ?? "").includes("railway.internal"),
    ) ??
    domains.find((domain) =>
      (domain.domain ?? "").endsWith(".railway.internal"),
    ) ??
    null;

  if (!privateMatch?.domain) return null;
  return {
    domain: privateMatch.domain,
    targetPort: privateMatch.targetPort ?? null,
  };
}

function selectPublicDomain(
  serviceDomains: Array<{
    domain?: string | null;
    suffix?: string | null;
    targetPort?: number | null;
  }>,
  customDomains: Array<{ domain?: string | null; targetPort?: number | null }>,
): { domain: string; targetPort: number | null } | null {
  const customMatch =
    customDomains.find((domain) => Boolean(domain.domain)) ?? null;
  if (customMatch?.domain) {
    return {
      domain: customMatch.domain,
      targetPort: customMatch.targetPort ?? null,
    };
  }

  const publicServiceDomainMatch =
    serviceDomains.find((domain) => {
      const suffix = domain.suffix ?? "";
      return Boolean(suffix) && !suffix.includes("railway.internal");
    }) ??
    serviceDomains.find((domain) => {
      const hostname = domain.domain ?? "";
      return Boolean(hostname) && !hostname.endsWith(".railway.internal");
    }) ??
    null;

  if (!publicServiceDomainMatch?.domain) return null;
  return {
    domain: publicServiceDomainMatch.domain,
    targetPort: publicServiceDomainMatch.targetPort ?? null,
  };
}
