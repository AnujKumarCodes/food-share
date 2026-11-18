import { useState } from 'react';
import { Utensils } from 'lucide-react';

interface FoodImageProps {
  src?: string | null;
  alt: string;
  className?: string;
}

export function FoodImage({ src, alt, className = 'w-full h-full object-cover' }: FoodImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-green-50 via-emerald-50 to-amber-50 text-green-800 p-4 text-center ${className}`}
      >
        <Utensils className="w-7 h-7 mb-1.5 text-green-700/70" />
        <span className="text-xs font-medium text-green-900/80 line-clamp-2 max-w-[180px]">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
