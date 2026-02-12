export const logger = {
  info(message: string, metadata?: Record<string, unknown>) {
    log("INFO", message, metadata);
  },
  warn(message: string, metadata?: Record<string, unknown>) {
    log("WARN", message, metadata);
  },
  error(message: string, metadata?: Record<string, unknown>) {
    log("ERROR", message, metadata);
  }
};

function log(level: "INFO" | "WARN" | "ERROR", message: string, metadata?: Record<string, unknown>): void {
  const payload = {
    level,
    message,
    ts: new Date().toISOString(),
    ...metadata
  };
  console.log(JSON.stringify(payload));
}
