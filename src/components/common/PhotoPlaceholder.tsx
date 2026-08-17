import { ImageIcon } from 'lucide-react';

interface PhotoPlaceholderProps {
  label: string;
  className?: string;
}

// Stands in for a real photo slot until the school supplies one --
// labeled so it's obvious which real photo should go where, rather
// than filling the space with an unrelated stock photo.
const PhotoPlaceholder = ({ label, className = '' }: PhotoPlaceholderProps) => (
  <div className={`photo-placeholder ${className}`}>
    <ImageIcon size={28} />
    <span>{label}</span>
  </div>
);

export default PhotoPlaceholder;
