import crypto from "crypto";

export function generatePassword(length = 12) {
  return crypto.randomBytes(length).toString("base64").slice(0, length);
}
