/**
 * Canonical UUID format regex (format-only, version-agnostic).
 *
 * Matches `8-4-4-4-12` hex chars WITHOUT constraining the version nibble or
 * the variant nibble — i.e. accepts v1..v8.
 */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

export const isValidUuidV4 = isValidUuid;
