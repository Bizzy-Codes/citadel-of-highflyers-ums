const initials = (name: string) =>
  name.split(' ').filter(Boolean).map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?';

// The little round picture (or initials) used all over Spotlight.
const Avatar = ({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) => (
  <span className="sp-avatar" style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.36)) }}>
    {url ? <img src={url} alt="" /> : initials(name)}
  </span>
);

export default Avatar;
