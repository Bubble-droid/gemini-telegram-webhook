// src/types/script.d.ts

interface ExecutionSuccess {
  success: true;
  result: unknown;
  duration: number;
}

interface ExecutionError {
  success: false;
  error: string;
  duration: number;
}

export type ScriptExecutionResult = ExecutionSuccess | ExecutionError;
