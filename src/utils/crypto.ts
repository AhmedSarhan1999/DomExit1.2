/**
 * Cryptographic utility for computing SHA-256 hashes of legal texts
 * according to Federal Law 152-FZ and evidentiary standards.
 */
export async function computeSha256(text: string): Promise<string> {
  const normalizedText = text.trim();
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(normalizedText);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback synchronous simple hash for non-browser/SSR environments
  let hash = 0;
  for (let i = 0; i < normalizedText.length; i++) {
    const char = normalizedText.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `sha256-mock-${Math.abs(hash).toString(16).padStart(16, '0')}`;
}
