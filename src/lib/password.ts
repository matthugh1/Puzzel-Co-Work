/**
 * Password validation and strength checking
 */

// @ts-expect-error - zxcvbn doesn't have TypeScript definitions
import zxcvbn from "zxcvbn";

/**
 * Check password strength using zxcvbn
 * Returns score: 0-4 (0 = very weak, 4 = very strong)
 */
export function checkPasswordStrength(password: string): {
  score: number;
  feedback: string[];
  isStrong: boolean;
} {
  const result = zxcvbn(password);
  const feedback: string[] = [];

  if (result.feedback.warning) {
    feedback.push(result.feedback.warning);
  }

  if (result.feedback.suggestions.length > 0) {
    feedback.push(...result.feedback.suggestions);
  }

  // Require score of at least 2 (moderate strength)
  return {
    score: result.score,
    feedback,
    isStrong: result.score >= 2,
  };
}

/**
 * Validate password meets requirements
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }

  if (password.length > 128) {
    errors.push("Password must be less than 128 characters");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  // Check against common passwords
  const strength = checkPasswordStrength(password);
  if (strength.score < 2) {
    errors.push("Password is too weak. " + strength.feedback.join(" "));
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
