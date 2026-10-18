export interface Rfc7807Error {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: string;
  instance?: string;
}

/**
 * Formats an error response conforming to RFC 7807 Problem Details specification.
 */
export function formatRfc7807(
  statusCode: number,
  code: string,
  title: string,
  detail: string,
  instance?: string
): Rfc7807Error {
  return {
    type: `https://api.smexstore.com/errors/${code.toLowerCase().replace(/_/g, '-')}`,
    title,
    status: statusCode,
    detail,
    code,
    ...(instance ? { instance } : {}),
  };
}
