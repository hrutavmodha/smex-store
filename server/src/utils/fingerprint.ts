import crypto from 'node:crypto';

export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'unknown';

export interface DeviceMetadata {
  deviceName: string;
  deviceType?: DeviceType;
  deviceFingerprint: string;
  ipAddress: string;
  userAgent: string;
}

export function resolveDeviceType(userAgent: string): DeviceType {
  const ua = userAgent || '';
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) {
    return 'tablet';
  }
  if (/mobi|iphone|ipod|android/i.test(ua)) {
    return 'mobile';
  }
  if (/windows|macintosh|mac os x|linux|cros/i.test(ua)) {
    return 'desktop';
  }
  return 'unknown';
}

export function parseDeviceMetadata(
  userAgent: string,
  ipAddress: string,
  acceptLanguage?: string
): DeviceMetadata {
  const cleanUa = userAgent || '';
  const cleanIp = ipAddress || '127.0.0.1';
  const cleanLang = acceptLanguage || '';

  let browser = 'Unknown Browser';
  let os = 'Unknown OS';

  // Detect browser (check specific ones before general ones)
  if (/edg\//i.test(cleanUa)) {
    browser = 'Edge';
  } else if (/opr\/|opera/i.test(cleanUa)) {
    browser = 'Opera';
  } else if (/chrome|crios/i.test(cleanUa)) {
    browser = 'Chrome';
  } else if (/firefox|fxios/i.test(cleanUa)) {
    browser = 'Firefox';
  } else if (/safari/i.test(cleanUa) && !/chrome|crios/i.test(cleanUa)) {
    browser = 'Safari';
  }

  // Detect operating system
  if (/windows/i.test(cleanUa)) {
    os = 'Windows';
  } else if (/iphone|ipad|ipod/i.test(cleanUa)) {
    os = 'iOS';
  } else if (/mac os x|macintosh/i.test(cleanUa)) {
    os = 'macOS';
  } else if (/android/i.test(cleanUa)) {
    os = 'Android';
  } else if (/linux/i.test(cleanUa)) {
    os = 'Linux';
  }

  const deviceName =
    browser === 'Unknown Browser' && os === 'Unknown OS'
      ? 'Unknown Device'
      : `${browser} on ${os}`;

  const deviceType = resolveDeviceType(cleanUa);

  const deviceFingerprint = crypto
    .createHash('sha256')
    .update(cleanUa + cleanLang)
    .digest('hex');

  return {
    deviceName,
    deviceType,
    deviceFingerprint,
    ipAddress: cleanIp,
    userAgent: cleanUa,
  };
}
