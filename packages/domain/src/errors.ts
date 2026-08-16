/**
 * Typed domain errors.
 *
 * Application boundaries map these to HTTP responses; the database layer
 * maps provider errors into these. Raw database/provider errors must never
 * reach the UI.
 */

export abstract class DomainError extends Error {
  abstract readonly code: string;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;

  constructor(message: string, statusCode: number, details?: Record<string, unknown>) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class AuthenticationError extends DomainError {
  readonly code = "AUTHENTICATION_ERROR";
  constructor(message = "Authentication required.") {
    super(message, 401);
  }
}

export class AuthorizationError extends DomainError {
  readonly code = "AUTHORIZATION_ERROR";
  constructor(message = "You do not have permission to perform this action.") {
    super(message, 403);
  }
}

export class ValidationError extends DomainError {
  readonly code = "VALIDATION_ERROR";
  constructor(message = "The provided input is invalid.", details?: Record<string, unknown>) {
    super(message, 400, details);
  }
}

export class NotFoundError extends DomainError {
  readonly code = "NOT_FOUND_ERROR";
  constructor(message = "The requested resource was not found.") {
    super(message, 404);
  }
}

export class ConflictError extends DomainError {
  readonly code = "CONFLICT_ERROR";
  constructor(message = "The request conflicts with the current state.") {
    super(message, 409);
  }
}

export class EligibilityError extends DomainError {
  readonly code = "ELIGIBILITY_ERROR";
  constructor(message = "Eligibility could not be determined.") {
    super(message, 422);
  }
}

export class ExternalServiceError extends DomainError {
  readonly code = "EXTERNAL_SERVICE_ERROR";
  constructor(message = "An external service failed.", details?: Record<string, unknown>) {
    super(message, 502, details);
  }
}

export class RateLimitError extends DomainError {
  readonly code = "RATE_LIMIT_ERROR";
  constructor(message = "Too many requests. Please try again later.") {
    super(message, 429);
  }
}

export class StateTransitionError extends DomainError {
  readonly code = "STATE_TRANSITION_ERROR";
  constructor(message = "This transition is not allowed in the current state.") {
    super(message, 409);
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
