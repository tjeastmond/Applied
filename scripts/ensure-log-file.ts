import { lstatSync } from "node:fs";
import { join } from "node:path";
import { loadProjectEnvFiles } from "@/lib/server/loadEnvFile";
import { readLogConfig } from "@/lib/server/logging/config";
import { flushLogs, initLogger } from "@/lib/server/logging/logger";

function pathEntryExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

loadProjectEnvFiles();

const config = readLogConfig();

if (!config.enabled) {
  console.error("Logging is disabled. Set LOG_ENABLED=true in .env.local to tail logs.");
  process.exit(2);
}

await initLogger();
await flushLogs();

const currentPath = join(config.dir, "current.log");
const logPath = join(config.dir, config.file);

if (!pathEntryExists(currentPath) && !pathEntryExists(logPath)) {
  console.error("Log file was not created.");
  process.exit(1);
}
