import crypto from "crypto";

/**
 * Generates a secure, cryptographically random API key
 * prefixed with 'cobalt_' for identification.
 */
export function generateApiKey(): string {
  const bytes = crypto.randomBytes(24);
  return `cobalt_${bytes.toString("hex")}`;
}
