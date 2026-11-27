/**
 * useSeoMeta.ts
 * Dynamic SEO, OpenGraph and Schema.org JSON-LD manager for SPA pages.
 * Ensures clean injection and restores tags on component unmount.
 */

import { useEffect } from 'react';

export interface SeoMetaProps {
  title: string;
  description?: string;
  canonicalUrl?: string;
  ogType?: 'website' | 'article';
  jsonLd?: Record<string, any>;
}

export function useSeoMeta({
  title,
  description,
  canonicalUrl,
  ogType = 'website',
  jsonLd,
}: SeoMetaProps) {
  useEffect(() => {
    const originalTitle = document.title;
    document.title = title;

    // Helper for meta tags
    const setMeta = (nameOrProperty: string, value: string, isProperty = false) => {
      const attr = isProperty ? 'property' : 'name';
      let el = document.querySelector(`meta[${attr}="${nameOrProperty}"]`) as HTMLMetaElement;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, nameOrProperty);
        document.head.appendChild(el);
      }
      el.content = value;
    };

    if (description) {
      setMeta('description', description);
      setMeta('og:description', description, true);
      setMeta('twitter:description', description);
    }

    setMeta('og:title', title, true);
    setMeta('twitter:title', title);
    setMeta('og:type', ogType, true);

    if (canonicalUrl) {
      setMeta('og:url', canonicalUrl, true);
      let canonicalEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (!canonicalEl) {
        canonicalEl = document.createElement('link');
        canonicalEl.rel = 'canonical';
        document.head.appendChild(canonicalEl);
      }
      canonicalEl.href = canonicalUrl;
    }

    // JSON-LD injection
    let jsonLdScript = document.getElementById('domexit-jsonld') as HTMLScriptElement;
    if (jsonLd) {
      if (!jsonLdScript) {
        jsonLdScript = document.createElement('script');
        jsonLdScript.id = 'domexit-jsonld';
        jsonLdScript.type = 'application/ld+json';
        document.head.appendChild(jsonLdScript);
      }
      jsonLdScript.text = JSON.stringify(jsonLd);
    } else if (jsonLdScript) {
      jsonLdScript.remove();
    }

    return () => {
      document.title = originalTitle;
      const script = document.getElementById('domexit-jsonld');
      if (script) script.remove();
    };
  }, [title, description, canonicalUrl, ogType, jsonLd]);
}
