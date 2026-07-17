// In-memory job tracking for Social Studio generations (single Node process).
// Deliberately NOT a content-type: jobs are ephemeral UI state. Restart safety
// comes from the pipeline uploading every expensive artifact (bg image, video
// clip, portada) to the Media Library AS SOON as it exists — a lost job only
// loses free recompose work. Entries expire after 2h (tmp dir cleaned).
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import type { GenerateRequest, StudioFormat } from "./cost-registry";

export type StepStatus = "pending" | "running" | "done" | "error";

export interface StudioJobStep {
  key: string;
  label: string;
  status: StepStatus;
  detail?: string;
}

export interface PortadaResult {
  type: "portada";
  fileId: number;
  url: string;
  imagePrompt: string;
}

export interface DeckResult {
  type: "deck";
  slides: unknown[];
  caption?: string;
  coverPrompt?: string | null;
  bgFileId: number | null;
  size: "portrait" | "story";
  previews: string[]; // half-scale data URIs
}

export interface ReelResult {
  type: "reel";
  clipFileId: number;
  clipUrl: string;
  overlay: { type: "title" | "countdown"; fields: Record<string, string> };
  seconds: number;
  videoModel: string;
}

// Historia en formato video: la placa (slide editable) va como overlay
// transparente sobre el clip; el preview se sirve del tmp del job.
export interface StoryVideoResult {
  type: "story-video";
  slide: unknown;
  clipFileId: number;
  clipUrl: string;
  seconds: number;
  videoModel: string;
}

export type StudioJobResult = PortadaResult | DeckResult | ReelResult | StoryVideoResult;

export interface StudioJob {
  id: string;
  kind: StudioFormat;
  status: "running" | "completed" | "failed";
  createdAt: number;
  updatedAt: number;
  steps: StudioJobStep[];
  request: GenerateRequest;
  estimatedCostUsd: number;
  result?: StudioJobResult;
  error?: string;
  tmpDir?: string;
}

const TTL_MS = 2 * 60 * 60 * 1000;
const MAX_ACTIVE = 2;

const jobs = new Map<string, StudioJob>();

function sweep(): void {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.updatedAt > TTL_MS) {
      if (job.tmpDir) fs.rm(job.tmpDir, { recursive: true, force: true }, () => {});
      jobs.delete(id);
    }
  }
}

export function activeCount(): number {
  let n = 0;
  for (const job of jobs.values()) if (job.status === "running") n++;
  return n;
}

export function canCreateJob(): boolean {
  sweep();
  return activeCount() < MAX_ACTIVE;
}

export function createJob(
  kind: StudioFormat,
  request: GenerateRequest,
  estimatedCostUsd: number,
  steps: Array<{ key: string; label: string }>,
): StudioJob {
  const job: StudioJob = {
    id: randomUUID(),
    kind,
    status: "running",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    steps: steps.map((s) => ({ ...s, status: "pending" as StepStatus })),
    request,
    estimatedCostUsd,
  };
  jobs.set(job.id, job);
  return job;
}

export function getJob(id: string): StudioJob | undefined {
  return jobs.get(id);
}

export function updateStep(
  job: StudioJob,
  key: string,
  patch: Partial<Pick<StudioJobStep, "status" | "detail">>,
): void {
  const step = job.steps.find((s) => s.key === key);
  if (step) Object.assign(step, patch);
  job.updatedAt = Date.now();
}

export function completeJob(job: StudioJob, result: StudioJobResult): void {
  job.status = "completed";
  job.result = result;
  for (const s of job.steps) if (s.status === "running") s.status = "done";
  job.updatedAt = Date.now();
}

export function failJob(job: StudioJob, error: string): void {
  job.status = "failed";
  job.error = error;
  for (const s of job.steps) if (s.status === "running") s.status = "error";
  job.updatedAt = Date.now();
}
