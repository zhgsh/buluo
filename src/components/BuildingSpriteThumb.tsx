import React, { useEffect, useState } from 'react';
import {
  BUILDING_IMAGE_URLS,
  getBuildingSprite,
  preloadBuildingSprites,
  subscribeBuildingSprites,
} from '../game/buildingAssets';
import { BuildingBadgeIcon } from '../game/svgIcons';
import type { BuildingType } from '../game/types';

interface BuildingSpriteThumbProps {
  type: BuildingType;
  alt: string;
  className?: string;
}

export const BuildingSpriteThumb: React.FC<BuildingSpriteThumbProps> = ({
  type,
  alt,
  className = 'w-11 h-11',
}) => {
  const [cachedDataUrl, setCachedDataUrl] = useState<string | null>(
    () => getBuildingSprite(type)?.dataUrl ?? null
  );
  const [retryCount, setRetryCount] = useState(0);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setRetryCount(0);
    setImgFailed(false);
    setCachedDataUrl(getBuildingSprite(type)?.dataUrl ?? null);
    preloadBuildingSprites();

    const sync = () => {
      const sprite = getBuildingSprite(type);
      if (sprite) {
        setCachedDataUrl(sprite.dataUrl);
        setImgFailed(false);
      }
    };
    sync();
    return subscribeBuildingSprites(sync);
  }, [type]);

  if (imgFailed) {
    return <BuildingBadgeIcon type={type} className={className} />;
  }

  const directUrl = BUILDING_IMAGE_URLS[type];
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
