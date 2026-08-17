import { useState } from 'react';
import PhotoPlaceholder from './PhotoPlaceholder';

interface PhotoSlotProps {
  src: string;
  alt: string;
  label: string;
  className?: string;
}

// Tries to load a real photo from a fixed local path; falls back to
// the labeled placeholder if the file isn't there yet. This lets the
// school drop real photos into src/assets/gallery/ with the expected
// filenames and have them appear with zero further code changes --
// no broken image in the meantime either way.
const PhotoSlot = ({ src, alt, label, className = '' }: PhotoSlotProps) => {
  const [failed, setFailed] = useState(false);
  if (failed) return <PhotoPlaceholder label={label} className={className} />;
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />;
};

export default PhotoSlot;
