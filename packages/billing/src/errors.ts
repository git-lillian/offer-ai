/**
 * Billing domain errors — typed, framework-free.
 *
 * Delivery layers map these to HTTP responses; repositories map provider errors
 * into these. Raw Stripe or database errors never surface to the UI.
 */

export abstract class BillingError extends Error {
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

export class BillingValidationError extends BillingError {
  readonly code = "BILLING_VALIDATION_ERROR";
  constructor(message = "The provided billing input is invalid.", details?: Record<string, unknown>) {
    super(message, 400, details);
  }
}

export class BillingNotFoundError extends BillingError {
  readonly code = "BILLING_NOT_FOUND";
  constructor(message = "Billing resource not found.") {
    super(message, 404);
  }
}

export class BillingConflictError extends BillingError {
  readonly code = "BILLING_CONFLICT";
  constructor(message = "Billing resource conflict.") {
    super(message, 409);
  }
}

export class BillingStateTransitionError extends BillingError {
  readonly code = "BILLING_STATE_TRANSITION_ERROR";
  constructor(message = "Billing state transition not allowed.") {
    super(message, 409);
  }
}

export function isBillingError(error: unknown): error is BillingError {
  return error instanceof BillingError;
}
