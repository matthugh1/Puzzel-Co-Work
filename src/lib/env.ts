/**
 * Environment variable validation
 * Throws at startup if required variables are missing
 */

function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getOptionalEnvVar(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

export const env = {
  // Database
  DATABASE_URL: getEnvVar("DATABASE_URL"),

  // Auth
  NEXTAUTH_SECRET: getEnvVar("NEXTAUTH_SECRET"),
  NEXTAUTH_URL: getEnvVar("NEXTAUTH_URL"),

  // Environment
  NODE_ENV: getOptionalEnvVar("NODE_ENV", "development"),
} as const;

export type Env = typeof env;
