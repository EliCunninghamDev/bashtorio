/** Hex-encode a string for safe serial transport via printf '%b' */
export function encodeHex(text: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  return Array.from(bytes).map(b => `\\x${b.toString(16).padStart(2, '0')}`).join('');
}

/** Escape a string for use as a shell single-quoted argument */
export function shellEscape(text: string): string {
  return text.replace(/'/g, "'\\''");
}
