/**
 * Unit tests for stripSchemaNoise (to-ai-tools.ts).
 *
 * Verifies that:
 *  - `example`, `examples`, `deprecated` are removed from schemas.
 *  - `type`, `required`, `properties`, `description`, `enum` are preserved.
 *  - The input object is NOT mutated (the original retains its keys).
 *  - Nested objects are cleaned recursively (example inside a property).
 */

import { describe, expect, it } from "vitest";
import { stripSchemaNoise } from "@/lib/connectors/composio/to-ai-tools";

describe("stripSchemaNoise", () => {
  it("removes example, examples, deprecated from a flat schema", () => {
    const input = {
      type: "object",
      description: "A test schema",
      example: { foo: "bar" },
      examples: [{ foo: "baz" }],
      deprecated: true,
    };

    const result = stripSchemaNoise(input) as Record<string, unknown>;

    expect(result).not.toHaveProperty("example");
    expect(result).not.toHaveProperty("examples");
    expect(result).not.toHaveProperty("deprecated");
  });

  it("preserves type, required, properties, description, enum", () => {
    const input = {
      type: "object",
      description: "Send an email",
      required: ["to", "subject"],
      properties: {
        to: { type: "string", description: "Recipient" },
        subject: { type: "string" },
      },
      enum: ["a", "b"],
    };

    const result = stripSchemaNoise(input) as Record<string, unknown>;

    expect(result.type).toBe("object");
    expect(result.description).toBe("Send an email");
    expect(result.required).toEqual(["to", "subject"]);
    expect(result.enum).toEqual(["a", "b"]);
    expect(result.properties).toBeDefined();
  });

  it("does NOT mutate the original object — original retains its example key", () => {
    const input = {
      type: "string",
      description: "A field",
      example: "hello@example.com",
    };
    const originalKeys = Object.keys(input);

    stripSchemaNoise(input);

    // Original must be untouched
    expect(Object.keys(input)).toEqual(originalKeys);
    expect(input.example).toBe("hello@example.com");
  });

  it("removes example/examples/deprecated recursively inside properties", () => {
    const input = {
      type: "object",
      properties: {
        email: {
          type: "string",
          description: "Email address",
          example: "user@example.com",
          deprecated: false,
        },
        labels: {
          type: "array",
          examples: [["INBOX"], ["SENT"]],
          items: { type: "string" },
        },
      },
    };

    const result = stripSchemaNoise(input) as {
      properties: Record<string, Record<string, unknown>>;
    };

    expect(result.properties.email).not.toHaveProperty("example");
    expect(result.properties.email).not.toHaveProperty("deprecated");
    expect(result.properties.email.type).toBe("string");
    expect(result.properties.email.description).toBe("Email address");

    expect(result.properties.labels).not.toHaveProperty("examples");
    expect(result.properties.labels.type).toBe("array");
  });

  it("handles arrays by cleaning each element recursively", () => {
    const input = [
      { type: "string", example: "foo" },
      { type: "number", deprecated: true },
    ];

    const result = stripSchemaNoise(input) as Array<Record<string, unknown>>;

    expect(result[0]).not.toHaveProperty("example");
    expect(result[0].type).toBe("string");
    expect(result[1]).not.toHaveProperty("deprecated");
    expect(result[1].type).toBe("number");
  });

  it("returns primitives unchanged", () => {
    expect(stripSchemaNoise("hello")).toBe("hello");
    expect(stripSchemaNoise(42)).toBe(42);
    expect(stripSchemaNoise(true)).toBe(true);
    expect(stripSchemaNoise(null)).toBeNull();
  });
});
