/**
 * Input validation schemas using Zod
 * All user input must be validated before processing
 */

import { z } from "zod";

// Email validation
const emailSchema = z.string().email().max(255).toLowerCase().trim();

// Password validation - minimum 8 chars, at least one uppercase, lowercase, number, and special char
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be less than 128 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(
    /[^A-Za-z0-9]/,
    "Password must contain at least one special character",
  );

// Common validation schemas
export const validationSchemas = {
  // Authentication
  login: z.object({
    email: emailSchema,
    password: z.string().min(1, "Password is required"),
  }),

  // User management
  createUser: z.object({
    email: emailSchema,
    name: z.string().min(1).max(255).trim().optional(),
    password: z
      .string()
      .optional()
      .transform((val) => (val === "" ? undefined : val))
      .refine(
        (val) => val === undefined || passwordSchema.safeParse(val).success,
        "Password must meet strength requirements",
      ),
    organizationId: z.string().cuid().optional(), // Global admin can specify org
    roleId: z.string().cuid().optional(), // Organization role
  }),

  updateUser: z.object({
    name: z.string().min(1).max(255).trim().optional(),
    email: emailSchema.optional(),
    password: z
      .string()
      .optional()
      .transform((val) => (val === "" ? undefined : val))
      .refine(
        (val) => val === undefined || passwordSchema.safeParse(val).success,
        "Password must meet strength requirements",
      ),
    organizationId: z.string().cuid().optional(), // Global admin can change org
    roleId: z.string().cuid().optional(), // Organization role
  }),

  // Organization management
  createOrganization: z.object({
    name: z.string().min(1).max(255).trim(),
    slug: z
      .string()
      .min(1)
      .max(100)
      .trim()
      .regex(
        /^[a-z0-9-]+$/,
        "Slug must contain only lowercase letters, numbers, and hyphens",
      ),
  }),

  updateOrganization: z.object({
    name: z.string().min(1).max(255).trim().optional(),
    slug: z
      .string()
      .min(1)
      .max(100)
      .trim()
      .regex(
        /^[a-z0-9-]+$/,
        "Slug must contain only lowercase letters, numbers, and hyphens",
      )
      .optional(),
    isActive: z.boolean().optional(),
  }),

  // Organization member management
  addMember: z.object({
    userId: z.string().cuid(),
    roleId: z.string().cuid().optional(), // Organization role
  }),

  updateMemberRole: z.object({
    roleId: z.string().cuid().optional(), // null to remove role
  }),

  // Organization switch
  switchOrganization: z.object({
    organizationId: z.string().cuid(),
  }),

  // Cowork session management
  createCoworkSession: z.object({
    model: z
      .enum(["claude-sonnet-4-5", "claude-opus-4-5", "claude-haiku-4-5"])
      .default("claude-sonnet-4-5"),
    title: z.string().min(1).max(255).trim().optional(),
  }),

  updateCoworkSession: z.object({
    title: z.string().min(1).max(255).trim().optional(),
    status: z.enum(["active", "paused", "completed", "error"]).optional(),
    model: z
      .enum(["claude-sonnet-4-5", "claude-opus-4-5", "claude-haiku-4-5"])
      .optional(),
  }),

  // Cowork message
  sendCoworkMessage: z.object({
    content: z.string().max(100000).trim(),
    fileIds: z.array(z.string()).optional(),
    provider: z.enum(["anthropic", "openai"]).optional(),
    model: z.string().min(1).max(100).optional(),
    skillHint: z.string().min(1).max(120).trim().optional(),
  }),

  // Skill parameter (for create/update)
  skillParameter: z.object({
    name: z.string().min(1).max(80).trim(),
    label: z.string().min(1).max(120).trim(),
    type: z.enum(["text", "textarea", "select", "number", "boolean"]),
    description: z.string().max(500).trim(),
    required: z.boolean(),
    default: z.string().max(500).trim().optional(),
    options: z.array(z.string().max(200)).max(50).optional(),
  }),

  // Cowork skill create (API + CreateSkill tool)
  createCoworkSkill: z.object({
    name: z.string().min(1).max(120).trim(),
    description: z.string().max(500).trim(),
    category: z.string().max(80).trim().default("General"),
    triggers: z.array(z.string().max(80).trim()).max(20).default([]),
    tags: z.array(z.string().max(80).trim()).max(50).default([]),
    content: z.string().max(50_000).trim(),
    parameters: z
      .array(
        z.object({
          name: z.string().min(1).max(80).trim(),
          label: z.string().min(1).max(120).trim(),
          type: z.enum(["text", "textarea", "select", "number", "boolean"]),
          description: z.string().max(500).trim(),
          required: z.boolean(),
          default: z.string().max(500).trim().optional(),
          options: z.array(z.string().max(200)).max(50).optional(),
        }),
      )
      .max(20)
      .default([]),
    exampleInput: z.string().max(2_000).trim().optional(),
    exampleOutput: z.string().max(2_000).trim().optional(),
    status: z.enum(["draft", "published"]).default("draft"),
  }),

  // Cowork skill update (partial)
  updateCoworkSkill: z.object({
    name: z.string().min(1).max(120).trim().optional(),
    description: z.string().max(500).trim().optional(),
    category: z.string().max(80).trim().optional(),
    triggers: z.array(z.string().max(80).trim()).max(20).optional(),
    tags: z.array(z.string().max(80).trim()).max(50).optional(),
    content: z.string().max(50_000).trim().optional(),
    parameters: z
      .array(
        z.object({
          name: z.string().min(1).max(80).trim(),
          label: z.string().min(1).max(120).trim(),
          type: z.enum(["text", "textarea", "select", "number", "boolean"]),
          description: z.string().max(500).trim(),
          required: z.boolean(),
          default: z.string().max(500).trim().optional(),
          options: z.array(z.string().max(200)).max(50).optional(),
        }),
      )
      .max(20)
      .optional(),
    exampleInput: z.string().max(2_000).trim().optional().nullable(),
    exampleOutput: z.string().max(2_000).trim().optional().nullable(),
    status: z.enum(["draft", "published"]).optional(),
  }),

  // Cowork todo update
  updateCoworkTodos: z.object({
    todos: z.array(
      z.object({
        id: z.string(),
        content: z.string().min(1).max(500),
        activeForm: z.string().min(1).max(500),
        status: z.enum(["pending", "in_progress", "completed"]),
      }),
    ),
  }),

  // Cowork message feedback
  coworkMessageFeedback: z.object({
    rating: z.enum(["positive", "negative"]),
    comment: z.string().max(1000).trim().optional(),
  }),
};

/**
 * Validation error class
 */
export class ValidationError extends Error {
  constructor(
    public errors: Record<string, string[]>,
    message = "Validation failed",
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Validate request body against a Zod schema
 */
export async function validateRequestBody<T>(
  request: Request,
  schema: z.ZodSchema<T>,
): Promise<T> {
  const body = await request.json();
  const result = schema.safeParse(body);

  if (!result.success) {
    const errors: Record<string, string[]> = {};

    // Handle Zod validation errors - Zod uses 'issues' property
    if (result.error && "issues" in result.error) {
      const zodError = result.error as z.ZodError;
      zodError.issues.forEach((err) => {
        const path = err.path.length > 0 ? err.path.join(".") : "_general";
        if (!errors[path]) {
          errors[path] = [];
        }
        errors[path].push(err.message);
      });
    } else {
      // Fallback if error structure is unexpected
      errors["_general"] = ["Validation failed"];
    }

    throw new ValidationError(errors);
  }

  return result.data;
}
