import crypto from "node:crypto";

/**
 * @param {string | Buffer} content
 * @returns {string}
 */
export function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}
