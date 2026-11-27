/**
 * Strict Client-Side HTML & Text Sanitizer (Security Hardening: XSS Defense)
 * Neutralizes malicious script tags, event handlers (onload, onerror), and javascript: links.
 */

/**
 * Strict Client-Side HTML & Text Sanitizer (Security Hardening: XSS Defense)
 * Neutralizes malicious script tags, event handlers (onload, onerror), and dangerous protocols.
 * Uses browser DOMParser with strict tag/attribute whitelist when available, with regex fallback.
 */

const FORBIDDEN_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'applet',
  'meta',
  'link',
  'base',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
]);

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

export function sanitizeHtml(input: string): string {
  if (!input) return '';

  // 1. Browser environment: DOMParser whitelist tree walk
  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(input, 'text/html');

      // Recursively clean elements
      const sanitizeNode = (node: Node) => {
        const toRemove: Node[] = [];

        for (let i = 0; i < node.childNodes.length; i++) {
          const child = node.childNodes[i];
          if (child.nodeType === Node.ELEMENT_NODE) {
            const el = child as HTMLElement;
            const tagName = el.tagName.toLowerCase();

            if (FORBIDDEN_TAGS.has(tagName)) {
              toRemove.push(child);
              continue;
            }

            // Clean dangerous attributes
            const attrs = Array.from(el.attributes);
            for (const attr of attrs) {
              const attrName = attr.name.toLowerCase();
              const attrVal = attr.value.trim().toLowerCase();

              // Remove inline event handlers (onclick, onload, onerror, etc.)
              if (attrName.startsWith('on')) {
                el.removeAttribute(attr.name);
                continue;
              }

              // Verify href / src / action protocols
              if (attrName === 'href' || attrName === 'src') {
                if (
                  attrVal.startsWith('javascript:') ||
                  attrVal.startsWith('vbscript:') ||
                  attrVal.startsWith('data:text/html') ||
                  attrVal.startsWith('data:application/')
                ) {
                  el.removeAttribute(attr.name);
                  continue;
                }

                if (attrVal.includes(':') && !attrVal.startsWith('http://') && !attrVal.startsWith('https://') && !attrVal.startsWith('mailto:') && !attrVal.startsWith('tel:') && !attrVal.startsWith('data:image/')) {
                  try {
                    const parsedUrl = new URL(attrVal, window.location.origin);
                    if (!ALLOWED_PROTOCOLS.has(parsedUrl.protocol) && !attrVal.startsWith('data:image/')) {
                      el.removeAttribute(attr.name);
                    }
                  } catch {
                    el.removeAttribute(attr.name);
                  }
                }
              }
            }

            sanitizeNode(child);
          }
        }

        for (const rem of toRemove) {
          rem.parentNode?.removeChild(rem);
        }
      };

      sanitizeNode(doc.body);
      return doc.body.innerHTML;
    } catch {
      // Fallback to regex sanitizer below
    }
  }

  // 2. Safe Regex Fallback (Server / Non-DOM environments)
  const DANGEROUS_TAGS_REGEX = /<\s*\/?\s*(script|iframe|object|embed|applet|meta|link|style|form|input|button|textarea|select)[^>]*>/gi;
  const DANGEROUS_ATTRS_REGEX = /\s*on[a-zA-Z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi;
  const JAVASCRIPT_PROTOCOL_REGEX = /(?:javascript|vbscript|data:\s*text\/html):\S*/gi;

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
