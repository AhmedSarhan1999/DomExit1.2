/**
 * Strict Client-Side HTML & Text Sanitizer (Security Hardening: XSS Defense)
 * Neutralizes malicious script tags, event handlers (onload, onerror), and javascript: links.
 */

const DANGEROUS_TAGS_REGEX = /<\s*\/?\s*(script|iframe|object|embed|applet|meta|link|style)[^>]*>/gi;
const DANGEROUS_ATTRS_REGEX = /\s*(on\w+|javascript:|data:\s*text\/html)[^"'\s>]*=[^"'\s>]+/gi;
const JAVASCRIPT_PROTOCOL_REGEX = /javascript:/gi;

export function sanitizeHtml(input: string): string {
  if (!input) return '';
  
  return input
    .replace(DANGEROUS_TAGS_REGEX, '')
    .replace(DANGEROUS_ATTRS_REGEX, '')
    .replace(JAVASCRIPT_PROTOCOL_REGEX, 'blocked:');
}

export function escapeHtml(unsafeText: string): string {
  if (!unsafeText) return '';
  return unsafeText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validates and sanitizes a file upload name against directory traversal attacks
 */
export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\.\./g, '_')
    .trim()
    .slice(0, 150);
}
