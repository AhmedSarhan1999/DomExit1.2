import React, { useState } from 'react';

interface UserAvatarProps {
  src?: string | null;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  initialsClassName?: string;
  alt?: string;
}

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg' | 'xl', string> = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-xs',
  lg: 'w-12 h-12 text-sm',
  xl: 'w-16 h-16 text-base',
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  src,
  name = 'Пользователь',
  size = 'lg',
  className,
  initialsClassName,
  alt,
}) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const cleanSrc = String(src || '').trim();
  const failed = Boolean(cleanSrc && failedSrc === cleanSrc);
  const sizeClass = SIZE_CLASSES[size];
  const imgClass = className
    ? /\bw-/.test(className)
      ? className
      : `${sizeClass} rounded-full object-cover ${className}`
    : `${sizeClass} rounded-full object-cover`;
  const fallbackClass = initialsClassName
    ? /\bw-/.test(initialsClassName)
      ? initialsClassName
      : `${sizeClass} rounded-full bg-emerald-100 text-emerald-800 font-black flex items-center justify-center ${initialsClassName}`
    : `${sizeClass} rounded-full bg-emerald-100 text-emerald-800 font-black flex items-center justify-center`;

  const initials =
    String(name || 'DX')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase() || 'DX';

  if (!cleanSrc || failed) {
    return (
      <div className={fallbackClass} aria-label={alt || name}>
        {initials}
      </div>
    );
  }

  return (
    <img
      src={cleanSrc}
      alt={alt || name}
      className={imgClass}
      onError={() => setFailedSrc(cleanSrc)}
    />
  );
};
