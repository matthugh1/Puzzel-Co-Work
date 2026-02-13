/**
 * LLM abstraction utilities (e.g. OpenAI strict schema).
 * Used by adapters and by scripts that validate tool schemas.
 */

import type { CanonicalToolInputSchema } from "./types";

/**
 * Recursively make schema strict for OpenAI:
 * - Every object gets additionalProperties: false and all properties in required
 * - Properties not in the original required list get null added to their type
 * - Recurses into nested objects and array items
 */
export function enforceStrictSchema(
  schema: CanonicalToolInputSchema,
): Record<string, unknown> {
  return enforceStrictSchemaRecursive(schema as Record<string, unknown>);
}

function enforceStrictSchemaRecursive(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const type = schema.type;

  // Array: recurse into items
  if (type === "array" && schema.items && typeof schema.items === "object") {
    return {
      ...schema,
      items: enforceStrictSchemaRecursive(
        schema.items as Record<string, unknown>,
      ),
    };
  }

  // Not an object: return as-is
  if (type !== "object") return schema;

  const properties = (schema.properties ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const required = (schema.required ?? []) as string[];
  const allPropertyNames = Object.keys(properties);
  const strictProperties: Record<string, unknown> = {};

  for (const [key, prop] of Object.entries(properties)) {
    // Recurse into the property first
    let processed = enforceStrictSchemaRecursive(prop);

    // If this property wasn't originally required, make it nullable
    if (!required.includes(key) && processed.type !== undefined) {
      const currentType = processed.type;
      const types = Array.isArray(currentType)
        ? (currentType as string[])
        : [currentType as string];
      if (!types.includes("null")) {
        processed = { ...processed, type: [...types, "null"] };
      }
    }

    strictProperties[key] = processed;
  }

  return {
    type: "object",
    properties: strictProperties,
    required: allPropertyNames,
    additionalProperties: false,
  };
}
