import React, { useEffect, useState } from 'react';
import { TroopBadgeIcon } from '../game/svgIcons';
import {
  TROOP_IMAGE_URLS,
  getTroopSprite,
  preloadTroopSprites,
  subscribeTroopSprites,
} from '../game/troopAssets';
import type { TroopType } from '../game/types';

interface TroopSpriteThumbProps {
  type: TroopType;
  alt: string;
  className?: string;
}

export const TroopSpriteThumb: React.FC<TroopSpriteThumbProps> = ({
  type,
  alt,
  className = 'w-11 h-11',
}) => {
  const [cachedDataUrl, setCachedDataUrl] = useState<string | null>(
    () => getTroopSprite(type)?.dataUrl ?? null
  );
  const [retryCount, setRetryCount] = useState(0);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setRetryCount(0);
    setImgFailed(false);
    setCachedDataUrl(getTroopSprite(type)?.dataUrl ?? null);
    preloadTroopSprites();

    const sync = () => {
      const sprite = getTroopSprite(type);
      if (sprite) {
        setCachedDataUrl(sprite.dataUrl);
        setImgFailed(false);
      }
    };
    sync();
    return subscribeTroopSprites(sync);
  }, [type]);

  if (imgFailed) {
    return <TroopBadgeIcon type={type} className={className} />;
  }

  const directUrl = TROOP_IMAGE_URLS[type];
  const src =
    cachedDataUrl ??
    (retryCount > 0
      ? `${directUrl}${directUrl.includes('?') ? '&' : '?'}retry=${retryCount}`
      : directUrl);

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => {
        if (retryCount < 2) {
          setCachedDataUrl(null);
          setRetryCount((c) => c + 1);
        } else {
          setImgFailed(true);
        }
      }}
      className={`${className} object-contain select-none`}
    />
  );
};
