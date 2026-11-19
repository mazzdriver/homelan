/**
 * JSON-lines protocol helper.
 * Returns a parsed object or null for empty/whitespace lines.
 * Throws on invalid JSON to surface protocol errors.
 */
export function parseLines(line) {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }
  return JSON.parse(trimmed);
}
