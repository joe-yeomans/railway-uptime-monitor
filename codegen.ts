import "dotenv/config";
import type { CodegenConfig } from "@graphql-codegen/cli";

const apiToken = process.env.RAILWAY_API_TOKEN;

if (!apiToken) {
  throw new Error(
    "RAILWAY_API_TOKEN is required to run GraphQL code generation",
  );
}

const config: CodegenConfig = {
  schema: {
    "https://backboard.railway.com/graphql/v2": {
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    },
  },
  documents: ["src/graphql/queries/**/*.graphql"],
  generates: {
    "src/graphql/generated/": {
      preset: "client",
      config: {
        useTypeImports: true,
      },
    },
  },
  ignoreNoDocuments: false,
};

export default config;
