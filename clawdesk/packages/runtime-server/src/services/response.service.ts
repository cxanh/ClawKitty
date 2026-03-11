import crypto from "node:crypto";

import type { ApiFailure, ApiMeta, ApiSuccess } from "@clawdesk/shared-types";

export function createMeta(): ApiMeta {
  return {
    requestId: crypto.randomUUID(),
    timestamp: new Date().toISOString()
  };
}

export function success<T>(data: T): ApiSuccess<T> {
  return {
    success: true,
    data,
    meta: createMeta()
  };
}

export function failure(code: string, message: string, details?: Record<string, unknown>): ApiFailure {
  return {
    success: false,
    error: {
      code,
      message,
      details
    },
    meta: createMeta()
  };
}
