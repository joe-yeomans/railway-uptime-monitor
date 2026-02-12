import { logger } from "../logger";

const RAILWAY_API_URL = "https://backboard.railway.com/graphql/v2";

export interface RailwayGraphQLClient {
  query<T>(query: string, variables: Record<string, unknown>): Promise<T>;
}

export function createRailwayClient(apiToken: string): RailwayGraphQLClient {
  return {
    async query<T>(
      query: string,
      variables: Record<string, unknown>,
    ): Promise<T> {
      const response = await fetch(RAILWAY_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `Railway GraphQL request failed (${response.status}): ${text}`,
        );
      }

      const json = (await response.json()) as {
        data?: T;
        errors?: Array<{ message: string }>;
      };

      if (json.errors?.length) {
        logger.error("Railway GraphQL responded with errors", {
          errors: json.errors.map((error) => error.message).join("; "),
        });
        throw new Error(
          `Railway GraphQL errors: ${json.errors.map((error) => error.message).join("; ")}`,
        );
      }

      if (!json.data) {
        throw new Error("Railway GraphQL response missing data");
      }

      return json.data;
    },
  };
}
