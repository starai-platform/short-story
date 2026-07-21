import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | "VALIDATION_ERROR"
  | "GENERATION_BUSY"
  | "INSUFFICIENT_POINTS"
  | "PROVIDER_ERROR"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_AUTH_ERROR"
  | "PROVIDER_RATE_LIMIT"
  | "PROVIDER_REQUEST_REJECTED"
  | "PROVIDER_OUTPUT_TRUNCATED"
  | "PROVIDER_CONTENT_FILTERED"
  | "OUTLINE_FORMAT_ERROR"
  | "OUTLINE_STRUCTURE_ERROR";

export function apiError(code: ApiErrorCode, message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: { code, message, ...(details ? { details } : {}) } }, { status });
}
