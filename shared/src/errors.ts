export interface Rfc7807Error {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: string;
  instance?: string;
  invalid_params?: Array<{ name: string; reason: string }>;
}

/**
 * Formats an error response conforming to RFC 7807 Problem Details specification.
 */
export function formatRfc7807(
  statusCode: number,
  code: string,
  title: string,
  detail: string,
  instance?: string,
  invalidParams?: Array<{ name: string; reason: string }>,
  type?: string
): Rfc7807Error {
  const error: Rfc7807Error = {
    type: type || `https://api.smexstore.com/errors/${code.toLowerCase().replace(/_/g, '-')}`,
    title,
    status: statusCode,
    detail,
    code,
  };
  if (instance) error.instance = instance;
  if (invalidParams && invalidParams.length > 0) error.invalid_params = invalidParams;
  return error;
}
