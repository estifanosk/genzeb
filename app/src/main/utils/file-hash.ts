import { createHash } from 'crypto'
import { readFileSync } from 'fs'

// Generate SHA-256 hash of file contents
export function hashFileContent(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex')
}

// Generate SHA-256 hash of a file
export function hashFile(filePath: string): string {
  const content = readFileSync(filePath, 'utf-8')
  return hashFileContent(content)
}

// Generate SHA-256 hash of binary file
export function hashBinaryFile(filePath: string): string {
  const content = readFileSync(filePath)
  return createHash('sha256').update(content).digest('hex')
}
