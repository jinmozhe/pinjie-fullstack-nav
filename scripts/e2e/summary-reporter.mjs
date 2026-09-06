import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Never serialize errors, request data, test titles, cookies, traces or attachments.
export default class SummaryReporter {
  results = [];
  onTestEnd(test, result) {
    this.results.push({ project: test.parent.project()?.name, status: result.status,
      file: test.location.file.replaceAll("\\", "/").split("/").at(-1), line: test.location.line,
      expected: test.expectedStatus, duration_ms: result.duration, retry: result.retry });
  }
  onEnd(result) {
    const directory = resolve(process.env.E2E_SUMMARY_DIR ?? "test-results");
    mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, "e2e-summary.json"), `${JSON.stringify({
      schema: "pinjie-e2e-summary-v1", status: result.status, duration_ms: result.duration,
      tests: this.results,
    }, null, 2)}\n`);
  }
}
