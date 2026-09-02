// ---------------------------------------------------------------------------
// Phase 8A: Production Error Containment & Credential Sanitization
// INVARIANT: Never expose API keys, secrets, Authorization headers, or internal
// paths to client payloads or logs. Never fabricate fallback financial data.
// ---------------------------------------------------------------------------

export type ErrorCategory =
  | 'DATA_UNAVAILABLE'
  | 'OPERATION_FAILED'
  | 'OPERATION_BLOCKED'
  | 'STALE_DATA'
  | 'AUTHENTICATION_FAILED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'VALIDATION_FAILED';

export interface SanitizedErrorResponse {
  success: false;
  category: ErrorCategory;
  error: string;
  code: string;
  statusCode: number;
  retryAfterSeconds?: number;
  timestamp: string;
}

/**
 * Sanitizes any raw string or error message by stripping credentials,
 * API secrets, headers, and internal system paths.
 */
export function sanitizeErrorMessage(rawMessage: string | null | undefined): string {
  if (!rawMessage || typeof rawMessage !== 'string') {
    return 'An unexpected internal error occurred.';
  }

  let sanitized = rawMessage;

  // 1. Scrub Alpaca and AI Key IDs and Secrets (e.g. PK..., AK..., secret patterns, Bearer tokens)
  sanitized = sanitized.replace(/(?:APCA-API-KEY-ID|ALPACA_API_KEY|FEATHERLESS_API_KEY|api_key|apiKey)[\s:=]+[A-Za-z0-9_-]{10,}/gi, '$1=[REDACTED]');
  sanitized = sanitized.replace(/(?:APCA-API-SECRET-KEY|ALPACA_SECRET_KEY|secret_key|secretKey|secret)[\s:=]+[A-Za-z0-9_-]{10,}/gi, '$1=[REDACTED]');
  sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]');
  sanitized = sanitized.replace(/Basic\s+[A-Za-z0-9._~+/-]+=*/gi, 'Basic [REDACTED]');

  // 2. Scrub specific known credential string values if loaded in process
  const envKeys = [
    process.env.ALPACA_API_KEY,
    process.env.ALPACA_SECRET_KEY,
    process.env.APCA_API_KEY_ID,
    process.env.APCA_API_SECRET_KEY,
    process.env.FEATHERLESS_API_KEY,
    process.env.LLM_API_KEY
  ].filter((k): k is string => Boolean(k && k.length > 5));

  for (const envKey of envKeys) {
    sanitized = sanitized.split(envKey).join('[REDACTED]');
  }

  // 3. Scrub absolute file paths
  sanitized = sanitized.replace(/[A-Za-z]:\\[\w\s.\\-]+/g, '[FILE_PATH]');
  sanitized = sanitized.replace(/\/(?:Users|home|var|usr|etc)\/[\w\s./\\-]+/g, '[FILE_PATH]');

  // 4. Scrub raw stack trace indicators
  sanitized = sanitized.replace(/\s+at\s+[\w.<>$]+(?:\s+\([^)]+\))?/g, '');

  return sanitized.trim() || 'Internal service error.';
}

export class DomainError extends Error {
  public readonly category: ErrorCategory;
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, options?: { category?: ErrorCategory; code?: string; statusCode?: number }) {
    const cleanMsg = sanitizeErrorMessage(message);
    super(cleanMsg);
    this.name = 'DomainError';
    this.category = options?.category || 'OPERATION_FAILED';
    this.code = options?.code || 'DOMAIN_ERROR';
    this.statusCode = options?.statusCode || 500;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toResponse(): SanitizedErrorResponse {
    return {
      success: false,
      category: this.category,
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: new Date().toISOString()
    };
  }
}

export class BrokerError extends DomainError {
  public readonly isRateLimit: boolean;
  public readonly isAuth: boolean;
  public readonly isNetwork: boolean;
  public readonly retryAfterSeconds?: number;

  constructor(message: string, options?: {
    statusCode?: number;
    code?: string;
    isRateLimit?: boolean;
    isAuth?: boolean;
    isNetwork?: boolean;
    retryAfterSeconds?: number;
  }) {
    let category: ErrorCategory = 'OPERATION_FAILED';
    if (options?.isRateLimit || options?.statusCode === 429) category = 'RATE_LIMIT_EXCEEDED';
    else if (options?.isAuth || options?.statusCode === 401 || options?.statusCode === 403) category = 'AUTHENTICATION_FAILED';
    else if (options?.isNetwork) category = 'DATA_UNAVAILABLE';

    super(message, {
      category,
      code: options?.code || 'BROKER_ERROR',
      statusCode: options?.statusCode || 502
    });
    this.name = 'BrokerError';
    this.isRateLimit = options?.isRateLimit || options?.statusCode === 429 || false;
    this.isAuth = options?.isAuth || options?.statusCode === 401 || options?.statusCode === 403 || false;
    this.isNetwork = options?.isNetwork || false;
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }

  override toResponse(): SanitizedErrorResponse {
    const res = super.toResponse();
    if (this.retryAfterSeconds !== undefined) {
      res.retryAfterSeconds = this.retryAfterSeconds;
    }
    return res;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, field?: string) {
    super(message, {
      category: 'VALIDATION_FAILED',
      code: field ? `INVALID_${field.toUpperCase()}` : 'VALIDATION_ERROR',
      statusCode: 400
    });
    this.name = 'ValidationError';
  }
}

export class RiskGateError extends DomainError {
  constructor(message: string) {
    super(message, {
      category: 'OPERATION_BLOCKED',
      code: 'RISK_GATE_BLOCKED',
      statusCode: 403
    });
    this.name = 'RiskGateError';
  }
}

export function formatSanitizedError(err: any, defaultMessage = 'Internal server error'): SanitizedErrorResponse {
  if (err instanceof DomainError) {
    return err.toResponse();
  }

  const rawMsg = err?.message || (typeof err === 'string' ? err : defaultMessage);
  const cleanMsg = sanitizeErrorMessage(rawMsg);

  return {
    success: false,
    category: 'OPERATION_FAILED',
    error: cleanMsg,
    code: 'INTERNAL_ERROR',
    statusCode: err?.statusCode || 500,
    timestamp: new Date().toISOString()
  };
}
