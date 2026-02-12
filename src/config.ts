export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export interface ResendConfig {
  apiKey: string;
  fromEmail: string;
  toEmail: string;
}

export interface AppConfig {
  databasePath: string;
  healthPort: number;
  healthcheckPath: string;
  railwayApiToken: string;
  railwayProjectId: string;
  railwayEnvironmentId: string;
  discoveryIntervalSeconds: number;
  checkIntervalSeconds: number;
  checkTimeoutMs: number;
  failureThreshold: number;
  recoveryThreshold: number;
  expectedStatusMin: number;
  expectedStatusMax: number;
  targetDomainMode: "private" | "public" | "auto";
  railwayServiceId?: string;
  railwayServiceName?: string;
  slackWebhookUrl?: string;
  discordWebhookUrl?: string;
  telegram?: TelegramConfig;
  resend?: ResendConfig;
  serviceIncludeList: string[];
  serviceExcludeList: string[];
}

export function loadConfig(): AppConfig {
  const railwayApiToken = required("RAILWAY_API_TOKEN");
  const railwayProjectId = required("RAILWAY_PROJECT_ID");
  const railwayEnvironmentId = required("RAILWAY_ENVIRONMENT_ID");

  const databasePath = resolvePath(
    Bun.env.DATABASE_PATH ?? "./data/monitor.db",
  );
  ensureParentDirectory(databasePath);

  return {
    databasePath,
    healthPort: numeric("PORT", 8080),
    healthcheckPath: healthcheckPath(),
    railwayApiToken,
    railwayProjectId,
    railwayEnvironmentId,
    discoveryIntervalSeconds: numeric("DISCOVERY_INTERVAL_SECONDS", 120),
    checkIntervalSeconds: numeric("CHECK_INTERVAL_SECONDS", 30),
    checkTimeoutMs: numeric("CHECK_TIMEOUT_MS", 5000),
    failureThreshold: numeric("FAILURE_THRESHOLD", 3),
    recoveryThreshold: numeric("RECOVERY_THRESHOLD", 2),
    expectedStatusMin: numeric("EXPECTED_STATUS_MIN", 200),
    expectedStatusMax: numeric("EXPECTED_STATUS_MAX", 299),
    targetDomainMode: targetDomainMode(),
    railwayServiceId: optional("RAILWAY_SERVICE_ID"),
    railwayServiceName: optional("RAILWAY_SERVICE_NAME"),
    slackWebhookUrl: optional("SLACK_WEBHOOK_URL"),
    discordWebhookUrl: optional("DISCORD_WEBHOOK_URL"),
    telegram: telegramConfig(),
    resend: resendConfig(),
    serviceIncludeList: csv("SERVICE_INCLUDE_LIST"),
    serviceExcludeList: csv("SERVICE_EXCLUDE_LIST"),
  };
}

function required(name: string): string {
  const value = Bun.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = Bun.env[name];
  return value && value.trim().length > 0 ? value : undefined;
}

function numeric(name: string, fallback: number): number {
  const raw = Bun.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (Number.isNaN(value) || value <= 0) {
    throw new Error(`Environment variable ${name} must be a positive number`);
  }
  return value;
}

function csv(name: string): string[] {
  const raw = Bun.env[name];
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function telegramConfig(): TelegramConfig | undefined {
  const botToken = optional("TELEGRAM_BOT_TOKEN");
  const chatId = optional("TELEGRAM_CHAT_ID");
  if (!botToken || !chatId) return undefined;
  return { botToken, chatId };
}

function resendConfig(): ResendConfig | undefined {
  const apiKey = optional("RESEND_API_KEY");
  const fromEmail = optional("RESEND_FROM_EMAIL");
  const toEmail = optional("RESEND_TO_EMAIL");
  if (!apiKey || !fromEmail || !toEmail) return undefined;
  return { apiKey, fromEmail, toEmail };
}

function targetDomainMode(): "private" | "public" | "auto" {
  const raw = optional("TARGET_DOMAIN_MODE");
  if (!raw) {
    return Bun.env.NODE_ENV === "production" ? "private" : "public";
  }

  const normalized = raw.toLowerCase();
  if (
    normalized === "private" ||
    normalized === "public" ||
    normalized === "auto"
  ) {
    return normalized;
  }

  throw new Error("TARGET_DOMAIN_MODE must be one of: private, public, auto");
}

function healthcheckPath(): string {
  const raw = optional("HEALTHCHECK_PATH");
  if (!raw) return "/healthz";

  const normalized = raw.trim();
  if (!normalized.startsWith("/")) {
    throw new Error("HEALTHCHECK_PATH must start with /");
  }

  return normalized;
}

function resolvePath(path: string): string {
  if (path.startsWith("/")) return path;
  const normalized = path.replace(/^\.\/+/, "");
  return `${process.cwd()}/${normalized}`;
}

function ensureParentDirectory(path: string): void {
  const slashIndex = path.lastIndexOf("/");
  if (slashIndex <= 0) return;
  const directory = path.slice(0, slashIndex);
  const result = Bun.spawnSync(["mkdir", "-p", directory]);
  if (result.exitCode !== 0) {
    throw new Error(`Failed to create database directory: ${directory}`);
  }
}
