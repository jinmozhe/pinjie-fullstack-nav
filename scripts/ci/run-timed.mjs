import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [label, command, ...args] = process.argv.slice(2);
if (!/^[a-z][a-z0-9-]{0,60}$/u.test(label ?? "") || !command) throw new Error("A safe label and command are required.");
const start = Date.now();
const child = spawn(command, args, { stdio: "inherit", shell: false, windowsHide: true });
const code = await new Promise((done) => {
  child.once("error", () => done(1));
  child.once("exit", (status) => done(status ?? 1));
});
const directory = resolve(process.env.RUNNER_TEMP ?? ".", "validation-metrics");
mkdirSync(directory, { recursive: true });
writeFileSync(resolve(directory, `${label}.json`), `${JSON.stringify({ label, duration_ms: Date.now() - start, exit_code: code })}\n`);
process.exitCode = code;
