import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import PhotoSlot from '../../components/common/PhotoSlot';
import { GALLERY_PHOTOS, GALLERY_CATEGORIES, type GalleryCategory } from '../../data/galleryPhotos';
import './Founders.css';
import './Gallery.css';

type FilterValue = 'All' | GalleryCategory;

const Gallery = () => {
  const [filter, setFilter] = useState<FilterValue>('All');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const filtered = filter === 'All' ? GALLERY_PHOTOS : GALLERY_PHOTOS.filter((p) => p.category === filter);

  // Changing category can shrink `filtered` out from under an open
  // lightbox, so close it right in the action that causes that,
  // rather than reacting to the mismatch after the fact.
  const changeFilter = (value: FilterValue) => {
    setFilter(value);
    setLightboxIndex(null);
  };

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight') setLightboxIndex((i) => (i === null ? i : (i + 1) % filtered.length));
      if (e.key === 'ArrowLeft') setLightboxIndex((i) => (i === null ? i : (i - 1 + filtered.length) % filtered.length));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIndex, filtered.length]);

  const active = lightboxIndex !== null ? filtered[lightboxIndex] : null;

  return (
    <div className="founders-root gallery-root">
      <nav className="founders-nav">
        <Link to="/" className="back-btn"><ArrowLeft size={20} /> Back to Home</Link>
        <div className="school-logo-small">
          <img src="/logo.jpg" alt="Logo" style={{ width: '32px', height: '32px', borderRadius: '50%', marginRight: '10px' }} />
          Citadel of Highflyers Int'l Academy
        </div>
      </nav>

      <header className="founders-header animate-fade-in">
        <span className="badge"><Sparkles size={14} style={{ marginRight: '6px' }} />Life at Citadel</span>
        <h1>Our <span>Gallery</span></h1>
        <p>Moments from our classrooms, playgrounds, excursions, and school activities -- browse by category or click any photo to take a closer look.</p>
      </header>

      <main className="container gallery-main">
        <div className="gallery-filter-row">
          <button
            className={`gallery-filter-pill ${filter === 'All' ? 'active' : ''}`}
            onClick={() => changeFilter('All')}
          >
            All
          </button>
          {GALLERY_CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`gallery-filter-pill ${filter === cat ? 'active' : ''}`}
              onClick={() => changeFilter(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <motion.div layout className="gallery-masonry">
          <AnimatePresence>
            {filtered.map((photo, i) => (
              <motion.div
                key={photo.file}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.25 }}
                className={`gallery-tile tile-${i % 6}`}
                onClick={() => setLightboxIndex(i)}
              >
                <PhotoSlot src={`/gallery/${photo.file}`} alt={photo.label} label={photo.label} className="gallery-tile-img" />
                <div className="gallery-tile-overlay">
                  <span className="gallery-tile-category">{photo.category}</span>
                  <span className="gallery-tile-label">{photo.label}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {filtered.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '60px 0' }}>No photos in this category yet.</p>
        )}
      </main>

      <AnimatePresence>
        {active && (
          <motion.div
            className="gallery-lightbox-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxIndex(null)}
          >
            <motion.div
              className="gallery-lightbox-content"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ type: 'spring', damping: 22, stiffness: 260 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button className="gallery-lightbox-close" onClick={() => setLightboxIndex(null)}><X size={22} /></button>

              {filtered.length > 1 && (
                <button
                  className="gallery-lightbox-nav prev"
                  onClick={() => setLightboxIndex((i) => (i === null ? i : (i - 1 + filtered.length) % filtered.length))}
                >
                  <ChevronLeft size={28} />
                </button>
              )}

              <PhotoSlot src={`/gallery/${active.file}`} alt={active.label} label={active.label} className="gallery-lightbox-img" />

              {filtered.length > 1 && (
                <button
                  className="gallery-lightbox-nav next"
                  onClick={() => setLightboxIndex((i) => (i === null ? i : (i + 1) % filtered.length))}
                >
                  <ChevronRight size={28} />
                </button>
              )}

              <div className="gallery-lightbox-caption">
                <span className="gallery-tile-category">{active.category}</span>
                <h3>{active.label}</h3>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="founders-footer">
        <div className="footer-blob"></div>
        <p>&copy; {new Date().getFullYear()} Citadel of Highflyers Int'l Academy. The Foundation for Future Generals.</p>
      </footer>
    </div>
  );
};

export default Gallery;
