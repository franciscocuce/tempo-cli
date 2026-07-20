export interface ExecutionResult {
  status: "ok" | "error";
  output: string;
  durationMs: number;
}
