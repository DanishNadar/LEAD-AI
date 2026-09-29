#!/usr/bin/env node

/**
 * Copies defined values from a local dotenv file to the linked Vercel project.
 * Values are passed over stdin and are never printed by this script.
 *
 * Examples:
 *   node scripts/sync-env-to-vercel.mjs --dry-run
 *   node scripts/sync-env-to-vercel.mjs --write --environment production
 *   node scripts/sync-env-to-vercel.mjs --write --all
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const supportedEnvironments = new Set(["production", "preview", "development"]);

function usage(exitCode = 0) {
  console.log(`
Usage: node scripts/sync-env-to-vercel.mjs [options]

Options:
  --source <path>          Dotenv file to upload (default: .env.local, then .env)
  --environment <targets>  Comma-separated targets: production, preview, development
                           (default: production)
  --all                    Upload to production, preview, and development
  --dry-run                List variable names and targets without changing Vercel
  --write                  Required to upload or overwrite variables
  --help                   Show this help

Before running with --write, authenticate and link this directory:
  npx vercel@latest login
  npx vercel@latest link
`);
  process.exit(exitCode);
}

function parseArguments(argv) {
  const options = {
    source: undefined,
    environments: ["production"],
    dryRun: false,
    write: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") usage();
    if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--write") options.write = true;
    else if (argument === "--all") options.environments = [...supportedEnvironments];
    else if (argument === "--source") {
      const source = argv[index + 1];
      if (!source) throw new Error("--source requires a file path.");
      options.source = resolve(projectRoot, source);
      index += 1;
    } else if (argument === "--environment") {
      const targets = argv[index + 1]?.split(",").map((value) => value.trim()).filter(Boolean);
      if (!targets?.length || targets.some((target) => !supportedEnvironments.has(target))) {
        throw new Error("--environment accepts production, preview, development, or a comma-separated combination.");
      }
      options.environments = [...new Set(targets)];
      index += 1;
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }
  if (!options.source) {
    options.source = resolve(
      projectRoot,
      existsSync(resolve(projectRoot, ".env.local")) ? ".env.local" : ".env",
    );
  }
  return options;
}

function parseDotenv(contents) {
  const variables = new Map();
  for (const rawLine of contents.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) throw new Error(`Unable to parse dotenv line for ${rawLine.split("=")[0] || "an unnamed variable"}.`);
    const [, name, rawValue] = match;
    let value = rawValue.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }
    variables.set(name, value.replace(/\\n/g, "\n"));
  }
  return variables;
}

function isSensitive(name) {
  // Browser variables are intentionally public. Everything else is protected
  // in Vercel's UI, including connection strings and service configuration.
  return !name.startsWith("NEXT_PUBLIC_");
}

function hasProjectLink() {
  return Boolean(process.env.VERCEL_PROJECT_ID) || existsSync(resolve(projectRoot, ".vercel", "project.json"));
}

function runVercel(args, input) {
  const executable = process.platform === "win32" ? "npx.cmd" : "npx";
  return new Promise((resolvePromise, reject) => {
    const child = spawn(executable, ["--yes", "vercel@latest", ...args], {
      cwd: projectRoot,
      stdio: ["pipe", "ignore", "ignore"],
      shell: false,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`Vercel CLI exited with status ${code}.`));
    });
    child.stdin.end(input);
  });
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (!existsSync(options.source)) throw new Error(`Dotenv file not found: ${options.source}`);
  if (!options.dryRun && !options.write) {
    throw new Error("Refusing to change Vercel. Re-run with --write, or use --dry-run to preview variable names.");
  }
  if (!options.dryRun && !hasProjectLink()) {
    throw new Error("This directory is not linked to a Vercel project. Run `npx vercel@latest link` first.");
  }

  const variables = parseDotenv(await readFile(options.source, "utf8"));
  if (variables.size === 0) throw new Error("No defined variables were found in the dotenv file.");

  console.log(`${options.dryRun ? "Would sync" : "Syncing"} ${variables.size} variable(s) to ${options.environments.join(", ")}.`);
  for (const name of variables.keys()) console.log(`  - ${name}`);
  if (options.dryRun) return;

  let completed = 0;
  for (const [name, value] of variables) {
    for (const environment of options.environments) {
      const args = ["env", "add", name, environment, "--force"];
      if (isSensitive(name)) args.push("--sensitive");
      try {
        await runVercel(args, value);
        completed += 1;
        console.log(`✓ ${name} → ${environment}`);
      } catch (error) {
        console.error(`✗ ${name} → ${environment}: ${error instanceof Error ? error.message : "Vercel upload failed."}`);
        process.exitCode = 1;
      }
    }
  }
  if (process.exitCode) throw new Error(`Only ${completed} environment value(s) uploaded.`);
  console.log(`Completed ${completed} Vercel environment value(s). Redeploy to apply them to a running deployment.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Unable to sync Vercel environment variables.");
  process.exitCode = 1;
});
