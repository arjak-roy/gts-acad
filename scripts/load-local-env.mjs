import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function loadLocalEnv(cwdOrOptions = process.cwd(), maybeOptions = {}) {
  const cwd = typeof cwdOrOptions === "string" ? cwdOrOptions : process.cwd();
  const options = typeof cwdOrOptions === "string" ? maybeOptions : cwdOrOptions;
  const preserveKeys = new Set(options.preserveKeys ?? []);

  const envFilePath = join(cwd, ".env");
  if (!existsSync(envFilePath)) {
    return;
  }

  const envFileContents = readFileSync(envFilePath, "utf8");

  for (const line of envFileContents.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
    const unquotedValue = rawValue.replace(/^(["'])(.*)\1$/, "$2");

    if (preserveKeys.has(key) && process.env[key]) {
      continue;
    }

    process.env[key] = unquotedValue;
  }
}