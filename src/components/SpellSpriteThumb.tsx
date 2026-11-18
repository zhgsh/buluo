import React, { useEffect, useState } from 'react';
import { SpellBadgeIcon } from '../game/svgIcons';
import {
  SPELL_IMAGE_URLS,
  SPELL_SPRITE_MAPPINGS,
  getSpellSprite,
  preloadSpellSprites,
  subscribeSpellSprites,
} from '../game/troopAssets';
import type { SpellType } from '../game/types';

interface SpellSpriteThumbProps {
  type: SpellType;
  alt: string;
  className?: string;
  imgClassName?: string;
  objectPosition?: string;
}

export const SpellSpriteThumb: React.FC<SpellSpriteThumbProps> = ({
  type,
  alt,
  className = 'w-11 h-11',
  imgClassName = '',
  objectPosition,
}) => {
  const [cachedDataUrl, setCachedDataUrl] = useState<string | null>(
    () => getSpellSprite(type)?.dataUrl ?? null
  );
  const [retryCount, setRetryCount] = useState(0);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setRetryCount(0);
    setImgFailed(false);
    setCachedDataUrl(getSpellSprite(type)?.dataUrl ?? null);
    preloadSpellSprites();

    const sync = () => {
      const sprite = getSpellSprite(type);
      if (sprite) {
        setCachedDataUrl(sprite.dataUrl);
        setImgFailed(false);
      }
    };
    sync();
    return subscribeSpellSprites(sync);
  }, [type]);

  if (imgFailed) {
    return <SpellBadgeIcon type={type} className={className} />;
  }

  const mapping = SPELL_SPRITE_MAPPINGS[type];
  const directUrl = mapping?.imageUrl ?? SPELL_IMAGE_URLS[type];
  const src =
    cachedDataUrl ??
    (retryCount > 0 && !directUrl.startsWith('data:')
      ? `${directUrl}${directUrl.includes('?') ? '&' : '?'}retry=${retryCount}`
      : directUrl);

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      style={{ objectPosition: objectPosition ?? mapping?.objectPosition ?? '50% 50%' }}
      onError={() => {
        if (retryCount < 2 && !directUrl.startsWith('data:')) {
          setCachedDataUrl(null);
          setRetryCount((c) => c + 1);
        } else {
          setImgFailed(true);
        }
      }}
      className={`${className} ${imgClassName} object-contain select-none`}
    />
  );
};
