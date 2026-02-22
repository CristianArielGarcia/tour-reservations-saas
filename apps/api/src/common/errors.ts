import { HttpException, HttpStatus } from '@nestjs/common';

// ─── Structured API errors ─────────────────────────────────────────────────
// Always throw these from service layer so the filter serializes them correctly.

export class ApiException extends HttpException {
  constructor(status: HttpStatus, code: string, message: string, details?: unknown) {
    super({ error: { code, message, details } }, status);
  }
}

// 404
export const notFound = (entity: string, id?: string) =>
  new ApiException(
    HttpStatus.NOT_FOUND,
    'not_found',
    id ? `${entity} '${id}' not found.` : `${entity} not found.`,
  );

// 403
export const forbidden = (message = 'Insufficient permissions.') =>
  new ApiException(HttpStatus.FORBIDDEN, 'forbidden', message);

// 409 — capacity
export const capacityExceeded = (
  capacityTotal: number,
  capacityUsed: number,
  requestedAdditional: number,
) =>
  new ApiException(HttpStatus.CONFLICT, 'capacity_exceeded', 'Departure capacity exceeded.', {
    capacity_total: capacityTotal,
    capacity_used: capacityUsed,
    requested_additional: requestedAdditional,
  });

// 409 — pricing overlap
export const pricingOverlap = () =>
  new ApiException(
    HttpStatus.CONFLICT,
    'pricing_overlap',
    'A price range already exists that overlaps with the requested validity dates.',
  );

// 409 — invalid transition
export const invalidTransition = (from: string, to: string) =>
  new ApiException(
    HttpStatus.CONFLICT,
    'invalid_transition',
    `Cannot transition reservation from '${from}' to '${to}'.`,
  );

// 409 — refund exceeds payment
export const refundExceedsPayment = () =>
  new ApiException(
    HttpStatus.CONFLICT,
    'refund_exceeds_payment',
    'Total refunded amount would exceed the payment amount.',
  );

// 422 — missing price
export const missingPrice = (itemCode: string) =>
  new ApiException(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'missing_price',
    `No active price found for tour item '${itemCode}' on the departure date in the selected currency.`,
  );

// 422 — currency mismatch
export const currencyMismatch = () =>
  new ApiException(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'currency_mismatch',
    'Payment currency must match reservation currency.',
  );

// 422 — invalid total (total_final went negative)
export const invalidTotal = () =>
  new ApiException(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'invalid_total',
    'The adjustment would cause the reservation total to become negative.',
  );

// 400 — generic validation
export const validationError = (message: string) =>
  new ApiException(HttpStatus.BAD_REQUEST, 'validation_error', message);
