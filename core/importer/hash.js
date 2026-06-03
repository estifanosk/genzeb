import crypto from "crypto";

export function hashFileContent(content) {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

export function makeId() {
  return crypto.randomUUID();
}
