import crypto from 'crypto';
import { UserRole } from './types';

/**
 * Deterministic cryptographic session token generator.
 */
export function createToken(role: UserRole, secret: string): string {
  return crypto.createHash('sha256').update(role + '_' + secret + '_SAIB_AUTH_SALT_2026').digest('hex');
}

/**
 * Returns the operator secret configured in server environment.
 * If unset, returns null to strictly disallow default/guessable operator access.
 */
export function getOperatorSecret(): string | null {
  const secret = (process.env.OPERATOR_PASSWORD || process.env.DASHBOARD_PASSWORD || '').trim();
  return secret.length > 0 ? secret : null;
}

/**
 * Returns the viewer passphrase (defaults to public demo passphrase 'alpaca2026').
 */
export function getViewSecret(): string {
  return (process.env.VIEW_PASSWORD || 'alpaca2026').trim();
}

/**
 * Inspects incoming request headers/cookies to verify authentication and role.
 */
export function verifyRequestRole(request: Request): { authenticated: boolean; role: UserRole | null } {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const tokenMatch = cookieHeader.match(/saib_session=([^;]+)/);
    const sessionToken = tokenMatch ? tokenMatch[1] : null;

    if (!sessionToken) {
      return { authenticated: false, role: null };
    }

    const opSecret = getOperatorSecret();
    if (opSecret && sessionToken === createToken('OPERATOR', opSecret)) {
      return { authenticated: true, role: 'OPERATOR' };
    }

    const viewSecret = getViewSecret();
    if (sessionToken === createToken('VIEWER', viewSecret)) {
      return { authenticated: true, role: 'VIEWER' };
    }

    return { authenticated: false, role: null };
  } catch {
    return { authenticated: false, role: null };
  }
}

/**
 * Returns true only if the request originates from an authenticated operator session.
 */
export function isOperator(request: Request): boolean {
  return verifyRequestRole(request).role === 'OPERATOR';
}
