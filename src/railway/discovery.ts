import type { DiscoveryFilter, DiscoveredRailwayService } from "../types";
import type { RailwayGraphQLClient } from "./client";

const DISCOVERY_QUERY = `
query DiscoverServices($projectId: String!, $environmentId: String!) {
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
                healthcheckPath
                latestDeployment {
                  healthcheckPath
                }
                privateDomain
                privatePort
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
                healthcheckPath?: string | null;
                latestDeployment?: { healthcheckPath?: string | null } | null;
                privateDomain?: string | null;
                privatePort?: number | null;
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
  filter: DiscoveryFilter
): Promise<DiscoveredRailwayService[]> {
  const data = await client.query<DiscoveryQueryResult>(DISCOVERY_QUERY, {
    projectId,
    environmentId
  });

  const environment = data.project.environments.edges.find((edge) => edge.node.id === environmentId)?.node;
  if (!environment) {
    throw new Error(`Could not find environment ${environmentId} in project ${projectId}`);
  }

  const includeSet = new Set(filter.includeServices ?? []);
  const excludeSet = new Set(filter.excludeServices ?? []);

  return environment.serviceInstances.edges
    .map((edge) => edge.node)
    .map((instance) => {
      const serviceId = instance.serviceId ?? instance.service?.id;
      const serviceName = instance.serviceName ?? instance.service?.name;
      const healthcheckPath = normalizePath(instance.healthcheckPath ?? instance.latestDeployment?.healthcheckPath ?? null);
      const privateHost = instance.privateDomain ?? (serviceName ? `${serviceName}.railway.internal` : null);
      const privatePort = instance.privatePort ?? 80;

      if (!serviceId || !serviceName || !healthcheckPath || !privateHost) return null;

      return {
        serviceId,
        serviceName,
        healthcheckPath,
        privateHost,
        privatePort
      } satisfies DiscoveredRailwayService;
    })
    .filter((service): service is DiscoveredRailwayService => Boolean(service))
    .filter((service) => (includeSet.size ? includeSet.has(service.serviceName) : true))
    .filter((service) => !excludeSet.has(service.serviceName));
}

function normalizePath(path: string | null): string | null {
  if (!path) return null;
  const normalized = path.trim();
  if (!normalized || normalized.includes("://")) return null;
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}
