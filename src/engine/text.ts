// Scene text uses terminal-like columns: Chinese glyphs occupy two columns.
const SINGLE = /^[\x20-\x7e¡-ÿ←-⇿─-◿⠀-⣿★☆♥♦♣♠♪♫☺☻✓✗✦✧]$/u
export function cellWidth(char: string): 1 | 2 {
  const cp = char.codePointAt(0) ?? 0
  return (cp >= 0x2e80 && cp <= 0xa4cf || cp >= 0xac00 && cp <= 0xd7a3 || cp >= 0xf900 && cp <= 0xfaff || cp >= 0xfe10 && cp <= 0xfe6f || cp >= 0xff01 && cp <= 0xff60 || cp >= 0xffe0 && cp <= 0xffe6 || cp >= 0x20000 && cp <= 0x3ffff) ? 2 : 1
}
export const drawable = (char: string) => SINGLE.test(char) || cellWidth(char) === 2
export const textWidth = (text: string) => [...text].reduce((width, char) => width + cellWidth(char), 0)
export function clipText(text: string, columns: number): string {
  let result = '', width = 0
  for (const char of text) { width += cellWidth(char); if (width > columns) break; result += char }
  return result
}
/** Keep Latin words together where possible; Chinese wraps between glyphs. */
export function wrapText(text: string, columns: number): string[] {
  const width = Math.max(2, columns), lines: string[] = []
  let line = ''
  for (const token of text.match(/[^\s\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe10-\ufe6f\uff01-\uff60]+|\s+|[\s\S]/gu) ?? []) {
    if (textWidth(line + token) > width && line && !/^\s+$/.test(token)) { lines.push(line.trimEnd()); line = '' }
    for (const char of token) {
      if (!line && /\s/.test(char)) continue
      if (textWidth(line) + cellWidth(char) > width) { lines.push(line.trimEnd()); line = '' }
      line += char
    }
  }
  if (line.trimEnd()) lines.push(line.trimEnd())
  return lines
}
