import crypto from "crypto";

export function hashFileContent(content: string) {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}
