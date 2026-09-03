export type UserRole = 'OPERATOR' | 'VIEWER';

export interface AuthSession {
  role: UserRole;
  token: string;
  expiresAt?: number;
}
