import React, { useEffect } from 'react';

interface JsonLdProps {
  id?: string;
  data: object;
}

export const JsonLdStructuredData: React.FC<JsonLdProps> = ({ id = 'json-ld-data', data }) => {
  const jsonString = JSON.stringify(data);

  useEffect(() => {
    // Inject or update in document.head for web crawlers / head-inspectors
    let scriptEl = document.getElementById(id) as HTMLScriptElement | null;
    if (!scriptEl) {
      scriptEl = document.createElement('script');
      scriptEl.id = id;
      scriptEl.type = 'application/ld+json';
      document.head.appendChild(scriptEl);
    }
    scriptEl.textContent = jsonString;

    return () => {
      const el = document.getElementById(id);
      if (el) {
        el.remove();
      }
    };
  }, [id, jsonString]);

  // Also render inside JSX for React 19 native SSR / hydration
  return (
    <script
      id={`${id}-jsx`}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonString }}
    />
  );
};
