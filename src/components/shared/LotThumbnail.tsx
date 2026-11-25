import React, { useState, useEffect } from 'react';
import { Building2 } from 'lucide-react';

interface LotThumbnailProps {
  src?: string | null;
  images?: string[];
  photos?: string[];
  approvedImages?: string[];
  alt?: string;
  className?: string;
  fallbackClassName?: string;
}

export const LotThumbnail: React.FC<LotThumbnailProps> = ({
  src,
  images,
  photos,
  approvedImages,
  alt = 'Объект DomExit',
  className = 'w-full h-full object-cover',
  fallbackClassName = 'w-full h-full flex items-center justify-center bg-slate-100 text-slate-400',
}) => {
  const resolved =
    [src, approvedImages?.[0], images?.[0], photos?.[0]]
      .map((u) => String(u || '').trim())
      .find((u) => u.length > 0 && !u.includes('undefined')) || '';

  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [resolved]);

  if (!resolved || failed) {
    return (
      <div className={fallbackClassName} aria-label={alt}>
        <Building2 className="w-6 h-6 opacity-60" />
      </div>
    );
  }

  return (
    <img
      src={resolved}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
};
