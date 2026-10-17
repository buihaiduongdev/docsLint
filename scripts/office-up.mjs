import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { officeEnv } from "./office-env.mjs";
await officeEnv();
const command = process.argv.includes("--all")
  ? ["up", "-d", "--build", "--wait", "--wait-timeout", "300"]
  : ["up", "-d", "--wait", "--wait-timeout", "300", "office"];
const compose = ["compose", "--env-file", ".local/office.env"];
// Pass an already configured trust root into the build without embedding it in the image.
if (process.env.NODE_EXTRA_CA_CERTS && process.argv.includes("--all")) {
  await writeFile(
    ".local/compose.trust.yaml",
    `services:\n  app:\n    build:\n      secrets:\n        - extra_ca\nsecrets:\n  extra_ca:\n    file: ${JSON.stringify(resolve(process.env.NODE_EXTRA_CA_CERTS))}\n`,
  );
  compose.push("-f", "compose.yaml", "-f", ".local/compose.trust.yaml");
}
const child = spawn("docker", [...compose, ...command], {
  stdio: "inherit",
  env: {
    ...process.env,
    BUILDX_CONFIG: process.env.BUILDX_CONFIG || resolve(".local/buildx"),
  },
});
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
