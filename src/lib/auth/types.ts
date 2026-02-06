/**
 * Auth types - shared across all auth providers
 */

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  roles: string[];
  permissions: string[];
  organizationId?: string; // Current organization context (from JWT)
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  token?: string;
  error?: string;
}

export interface AuthProvider {
  /**
   * Authenticate user with credentials
   */
  authenticate(credentials: LoginCredentials): Promise<AuthResult>;

  /**
   * Validate a token and return the user
   */
  validateToken(token: string): Promise<AuthUser | null>;

  /**
   * Refresh a token
   */
  refreshToken(token: string): Promise<string | null>;

  /**
   * Revoke a token (logout)
   */
  revokeToken(token: string): Promise<void>;
}

export interface Session {
  user: AuthUser;
  token: string;
  expiresAt: Date;
}
