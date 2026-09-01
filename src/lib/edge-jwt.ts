import type { ApplicationRole } from '@/lib/role-access';

const JWT_ALGORITHM = 'HS256';
const JWT_CLOCK_TOLERANCE_SECONDS = 5;
const MAX_JWT_LENGTH = 8192;
const APPLICATION_ROLES: readonly ApplicationRole[] = ['STUDENT', 'TEACHER', 'ADMIN'];
const UNSAFE_JWT_SECRETS = new Set([
  'your-secret-key-change-in-production',
  'dev-secret-key-change-in-production',
  'secret',
  'jwt-secret',
  '12345678901234567890123456789012',
]);

export interface EdgeAccessTokenPayload {
  userId: string;
  email: string;
  role: ApplicationRole;
  exp: number;
  iat?: number;
  nbf?: number;
}

function decodeBase64Url(segment: string): Uint8Array<ArrayBuffer> {
  if (!segment || !/^[A-Za-z0-9_-]+$/.test(segment)) {
    throw new Error('Invalid JWT segment');
  }
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function parseJsonSegment(segment: string): unknown {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(segment)));
}

function getEdgeJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || UNSAFE_JWT_SECRETS.has(secret)) {
    throw new Error('JWT_SECRET is missing or unsafe');
  }
  return secret;
}

function isApplicationRole(value: unknown): value is ApplicationRole {
  return typeof value === 'string' && APPLICATION_ROLES.includes(value as ApplicationRole);
}

export async function verifyEdgeAccessToken(
  token: string,
  nowEpochSeconds = Math.floor(Date.now() / 1000),
): Promise<EdgeAccessTokenPayload | null> {
  try {
    if (!token || token.length > MAX_JWT_LENGTH) return null;
    const segments = token.split('.');
    if (segments.length !== 3 || segments.some((segment) => !segment)) return null;
    const [encodedHeader, encodedPayload, encodedSignature] = segments;

    const header = parseJsonSegment(encodedHeader);
    if (!header || typeof header !== 'object') return null;
    const algorithm = 'alg' in header ? (header as { alg?: unknown }).alg : undefined;
    const tokenType = 'typ' in header ? (header as { typ?: unknown }).typ : undefined;
    if (algorithm !== JWT_ALGORITHM || (tokenType !== undefined && tokenType !== 'JWT')) return null;

    const signature = decodeBase64Url(encodedSignature);
    if (signature.byteLength !== 32) return null;
    const secretKey = await globalThis.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(getEdgeJwtSecret()),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const verified = await globalThis.crypto.subtle.verify(
      'HMAC',
      secretKey,
      signature,
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
    );
    if (!verified) return null;

    const payload = parseJsonSegment(encodedPayload);
    if (!payload || typeof payload !== 'object') return null;
    const claims = payload as Record<string, unknown>;
    if (
      typeof claims.userId !== 'string'
      || !claims.userId.trim()
      || typeof claims.email !== 'string'
      || !claims.email.trim()
      || !isApplicationRole(claims.role)
      || typeof claims.exp !== 'number'
      || !Number.isInteger(claims.exp)
      || claims.exp <= nowEpochSeconds - JWT_CLOCK_TOLERANCE_SECONDS
    ) {
      return null;
    }
    if (
      claims.nbf !== undefined
      && (typeof claims.nbf !== 'number'
        || !Number.isInteger(claims.nbf)
        || claims.nbf > nowEpochSeconds + JWT_CLOCK_TOLERANCE_SECONDS)
    ) {
      return null;
    }
    if (claims.iat !== undefined && (typeof claims.iat !== 'number' || !Number.isInteger(claims.iat))) {
      return null;
    }

    return {
      userId: claims.userId,
      email: claims.email,
      role: claims.role,
      exp: claims.exp,
      ...(typeof claims.iat === 'number' ? { iat: claims.iat } : {}),
      ...(typeof claims.nbf === 'number' ? { nbf: claims.nbf } : {}),
    };
  } catch {
    return null;
  }
}
