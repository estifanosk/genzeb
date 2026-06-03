import fs from "fs";
import path from "path";

export function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function fileExists(filePath: string) {
  return fs.existsSync(filePath);
}

export function readText(filePath: string) {
  return fs.readFileSync(filePath, "utf8");
}

export function writeText(filePath: string, content: string) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
}

export function appendText(filePath: string, content: string) {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, content, "utf8");
}
