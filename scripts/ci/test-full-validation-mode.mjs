import { readFile } from "node:fs/promises";
import YAML from "yaml";

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

const workflow = YAML.parse(await readFile(new URL("../../.github/workflows/ci-e2e.yml", import.meta.url), "utf8"));
const stageC = await readFile(new URL("../../e2e/stage-c.spec.ts", import.meta.url), "utf8");
const inputs = workflow.on?.workflow_dispatch?.inputs;
const source = workflow.jobs?.source;
const frontend = workflow.jobs?.frontend;
const frontendSteps = frontend?.steps ?? [];
const validation = workflow.jobs?.["full-validation"];
const validationSteps = validation?.steps ?? [];

requireCondition(inputs?.validation_mode?.type === "choice", "Full Validation mode must be a choice input.");
requireCondition(inputs.validation_mode.required === true, "Full Validation mode must be required.");
requireCondition(inputs.validation_mode.default === "full", "Full Validation mode must default to full.");
requireCondition(
  JSON.stringify(inputs.validation_mode.options) === JSON.stringify(["full", "smoke"]),
  "Full Validation mode must offer full and smoke in that order.",
);
requireCondition(
  source?.outputs?.validation_mode === "${{ steps.input.outputs.validation_mode }}",
  "Source job must expose the validated validation mode.",
);

const sourceInputStep = source.steps?.find((step) => step.id === "input");
requireCondition(sourceInputStep?.run?.includes("full|smoke"), "Source job must reject unknown validation modes.");
requireCondition(
  sourceInputStep?.run?.includes("validation_mode=$VALIDATION_MODE"),
  "Source job must persist the validated validation mode.",
);

const unitStep = frontendSteps.find((step) => step.name === "Run frontend unit tests");
const skipUnitStep = frontendSteps.find((step) => step.name === "Record skipped frontend unit tests");
const buildStep = frontendSteps.find((step) => String(step.run ?? "").includes("build pnpm"));
requireCondition(unitStep?.if === "${{ needs.source.outputs.validation_mode == 'full' }}", "Frontend tests must run only in full mode.");
requireCondition(skipUnitStep?.if === "${{ needs.source.outputs.validation_mode == 'smoke' }}", "Smoke mode must record skipped frontend tests.");
requireCondition(buildStep && !Object.hasOwn(buildStep, "if"), "Production builds must run in both validation modes.");

requireCondition(
  JSON.stringify(validation?.needs) === JSON.stringify(["source", "backend", "frontend"]),
  "Full Validation must retain source, backend, and frontend dependencies.",
);

const fullEvidence = validationSteps.find((step) => step.name === "Upload full validation evidence");
const smokeEvidence = validationSteps.find((step) => step.name === "Upload smoke validation evidence");
requireCondition(fullEvidence?.if === "${{ needs.source.outputs.validation_mode == 'full' }}", "Full evidence must be limited to full mode.");
requireCondition(smokeEvidence?.if === "${{ needs.source.outputs.validation_mode == 'smoke' }}", "Smoke evidence must be limited to smoke mode.");
requireCondition(
  fullEvidence.with?.name === "full-validation-${{ needs.source.outputs.commit_sha }}" &&
    fullEvidence.with?.path?.includes("full-validation-evidence"),
  "Full mode must retain the v2 Full Validation Artifact.",
);
requireCondition(
  smokeEvidence.with?.name === "smoke-validation-${{ needs.source.outputs.commit_sha }}" &&
    smokeEvidence.with?.path?.includes("smoke-validation-evidence"),
  "Smoke mode must use a separate Artifact.",
);

const fullEvidenceWriter = validationSteps.find((step) => step.name === "Write full validation evidence");
const smokeEvidenceWriter = validationSteps.find((step) => step.name === "Write smoke validation evidence");
const e2eStep = validationSteps.find((step) => String(step.run ?? "").includes("pnpm test:e2e"));
requireCondition(fullEvidenceWriter?.run?.includes("pinjie-full-validation-v2"), "Full mode must write the v2 evidence schema.");
requireCondition(smokeEvidenceWriter?.run?.includes("pinjie-smoke-validation-v1"), "Smoke mode must write a distinct evidence schema.");
requireCondition(smokeEvidenceWriter?.run?.includes("frontend_unit_tests=skipped"), "Smoke evidence must record skipped frontend tests.");
requireCondition(
  e2eStep?.env?.E2E_PROFILE === "${{ needs.source.outputs.validation_mode }}",
  "E2E must receive the selected Full Validation profile.",
);
requireCondition(
  smokeEvidenceWriter?.run?.includes("e2e_scope=all-quality-pages,desktop-stage-c"),
  "Smoke evidence must record its reduced browser scope.",
);
requireCondition(
  stageC.includes('process.env.E2E_PROFILE === "smoke"') && stageC.includes('!projectName.endsWith("-desktop")'),
  "Stage C must restrict smoke mode to desktop projects.",
);

console.log("Full Validation mode fixtures passed: full default, smoke gating, reduced E2E scope, production builds, and evidence separation.");
