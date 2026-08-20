import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, 
  BookOpen, 
  Users, 
  Award, 
  LogIn, 
  Menu, 
  X, 
  Sparkles, 
  Moon, 
  Sun,
  Video,
  CheckCircle,
  Play
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import PhotoSlot from '../../components/common/PhotoSlot';
import { GALLERY_PHOTOS } from '../../data/galleryPhotos';
import './Home.css';
import './Gallery.css';

const Home = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const whatsappLink = "https://wa.me/2347064970003?text=Hello,%20I'm%20interested%20in%20enrolling%20my%20child%20at%20Citadel%20of%20Highflyers%20Int'l%20Academy.%20Could%20you%20provide%20more%20information%20on%20the%20admission%20process?";

  return (
    <div className="home-container">

      {/* Modern Responsive Navigation */}
      <nav className="nav glass">
        <div className="logo-section">
          <Link to="/" className="logo-section">
             <img src="/logo.jpg" alt="Citadel Logo" className="logo-img" />
             <div className="logo-text">
               <span className="logo-main glowing-text">Citadel of Highflyers</span>
               <span className="logo-sub glowing-text">Int'l Academy</span>
             </div>
          </Link>
        </div>

        <div className={`nav-links ${isMenuOpen ? 'active' : ''}`}>
          <Link to="/" className="glowing-text" onClick={() => setIsMenuOpen(false)}>Home</Link>
          <Link to="/founders" className="glowing-text" onClick={() => setIsMenuOpen(false)}>Founders</Link>
          <Link to="/admissions" className="glowing-text" onClick={() => setIsMenuOpen(false)}>Admissions</Link>
          <Link to="/gallery" className="glowing-text" onClick={() => setIsMenuOpen(false)}>Gallery</Link>
        </div>

        <div className="nav-actions">
           <button onClick={toggleTheme} className="theme-toggle">
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
           </button>
           <Link to="/login" className="btn login-btn-ghost">
             <LogIn size={18} />
             <span className="login-btn-text-full">Portal Login</span>
             <span className="login-btn-text-short">Login</span>
           </Link>
           <button className="mobile-menu-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)}>
             {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
           </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="container hero-content">
          <motion.div 
            className="hero-text-area"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="badge-refined">
              <Sparkles size={14} /> Foundation for Future Generals
            </span>
            <h1>Empowering The <span>Next Generation</span> Of Generals</h1>
            <p>
              Citadel of Highflyers Int'l Academy is a co-educational private school 
              dedicated to providing quality education rooted in excellence, leadership, 
              and character. Join us as we nurture future leaders with the fear of God.
            </p>
            <div className="hero-actions">
              <Link to="/admissions" className="btn btn-primary lg">
                Apply for Admission
                <ArrowRight size={20} />
              </Link>
              <Link to="/founders" className="btn btn-outline lg">
                Meet Founders
              </Link>
            </div>
          </motion.div>
          
          <div className="hero-visual-area">
            <div className="hero-image-blob"></div>
            
            <motion.div 
              className="floating-card education"
              initial={{ x: -20, y: 0 }}
              animate={{ y: [0, -25, 0], x: [-20, -15, -20] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="card-inner premium-glass">
                <div className="icon-badge academic"><BookOpen size={20} /></div>
                <span>Academic Excellence</span>
              </div>
            </motion.div>

            <motion.div 
              className="floating-card excellence"
              initial={{ x: 20, y: 0 }}
              animate={{ y: [0, 25, 0], x: [20, 15, 20] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            >
              <div className="card-inner premium-glass">
                <div className="icon-badge facility"><Award size={20} /></div>
                <span>Modern Facilities</span>
              </div>
            </motion.div>

            <motion.div 
              className="floating-card character"
              initial={{ x: 30, y: -50 }}
              animate={{ y: [-50, -30, -50], x: [30, 40, 30] }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
            >
              <div className="card-inner premium-glass">
                <div className="icon-badge moral"><Sparkles size={20} /></div>
                <span>Godly Character</span>
              </div>
            </motion.div>

            <div className="hero-main-img-wrapper">
               <PhotoSlot src="/gallery/hero.jpg" alt="Pupils at Citadel of Highflyers" label="Photo: Pupils at Citadel" className="hero-main-img" />
            </div>
          </div>
        </div>
      </section>

      {/* Detailed Services Section (The Citadel Difference) */}
      <section className="why-citadel">
        <div className="container">
          <h2 className="section-title">The Citadel Difference</h2>
          <p className="section-subtitle">We don't just teach; we prepare generals for the battle of life with a blend of academic rigor and spiritual foundation.</p>

          <div className="features-grid-spiced">
            <div className="feature-item-large glass">
               <div className="feature-image">
                  <PhotoSlot src="/gallery/feature-learning.jpg" alt="Pupils at Citadel of Highflyers" label="Photo: Classroom Learning" />
                  <div className="play-overlay"><Play fill="white" size={40} color="white" /></div>
               </div>
               <div className="feature-text">
                  <h3>Holistic Learning Environment</h3>
                  <p>Our curriculum is a blend of international standards and local values, ensuring our pupils are globally competitive.</p>
                  <ul className="feature-list">
                     <li><CheckCircle size={16} /> British-Nigerian Integrated Curriculum</li>
                     <li><CheckCircle size={16} /> STEM & Digital Literacy for every grade</li>
                     <li><CheckCircle size={16} /> Personalized Attention with Small Class Sizes</li>
                  </ul>
               </div>
            </div>

            <div className="feature-side-grid">
               <div className="feature-item-small glass-purple hover-scale transition-all">
                  <div className="icon-wrap"><Users /></div>
                  <h4>Elite Educators</h4>
                  <p>Our staff are mentors trained to handle the unique developmental needs of every child.</p>
               </div>
               <div className="feature-item-small glass-purple hover-scale transition-all">
                  <div className="icon-wrap"><Video className="red" /></div>
                  <h4>Interactive Media</h4>
                  <p>We use digital tools and video resources to make learning fun and memorable.</p>
               </div>
               <div className="feature-item-small glass-purple hover-scale transition-all">
                  <div className="icon-wrap"><Sparkles className="yellow" /></div>
                  <h4>Moral Foundation</h4>
                  <p>Rooted in faith, we instill discipline, integrity, and honor in every child.</p>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="gallery-section" id="gallery-section">
         <div className="container">
            <h2 className="section-title">Glimpses of Excellence</h2>
            <p className="section-subtitle">A peek at classroom life, sports, excursions, and school activities -- click any photo for the full gallery.</p>
            <div className="gallery-masonry home-gallery-preview">
               {GALLERY_PHOTOS.slice(0, 6).map((photo, i) => (
                 <Link to="/gallery" key={photo.file} className={`gallery-tile tile-${i % 6}`}>
                    <PhotoSlot src={`/gallery/${photo.file}`} alt={photo.label} label={photo.label} className="gallery-tile-img" />
                    <div className="gallery-tile-overlay">
                       <span className="gallery-tile-category">{photo.category}</span>
                       <span className="gallery-tile-label">{photo.label}</span>
                    </div>
                 </Link>
               ))}
            </div>
            <div className="gallery-preview-cta">
               <Link to="/gallery" className="btn btn-primary lg">View Full Gallery <ArrowRight size={18} /></Link>
            </div>
         </div>
      </section>

      {/* CTA Section */}
      <section className="cta-banner">
         <div className="container">
            <div className="cta-content glass">
               <h2>Join the Family of Highflyers</h2>
               <p>Admissions are now open for the {new Date().getFullYear()}/{new Date().getFullYear() + 1} academic session.</p>
               <div className="cta-buttons">
                  <Link to="/admissions" className="btn btn-primary lg">Apply for Admission</Link>
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="btn btn-outline lg">Chat with Us on WhatsApp</a>
               </div>
            </div>
         </div>
      </section>

      {/* Footer */}
      <footer className="footer" style={{ marginTop: '100px' }}>
         <div className="container" style={{ padding: '80px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '60px' }}>
            <div className="footer-brand">
               <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                  <img src="/logo.jpg" alt="Logo" style={{ width: '50px', height: '50px', borderRadius: '50%' }} />
                  <span className="logo-main" style={{ fontSize: '20px' }}>Citadel of Highflyers Int'l Academy</span>
               </div>
               <p style={{ opacity: 0.8 }}>Foundation for Future Generals. Rock Haven opposite St. Murumba College, Jos North, Nigeria.</p>
               <div className="social-links" style={{ display: 'flex', gap: '20px', marginTop: '30px' }}>
                  <a href="https://www.youtube.com/@citadelofhighflyersintlaca7994" target="_blank" rel="noreferrer"><Video size={24} /></a>
                  <a href="https://www.instagram.com/princess_iwunna_321" target="_blank" rel="noreferrer"><Sparkles size={24} /></a>
               </div>
            </div>
            <div className="footer-links">
               <h4 style={{ marginBottom: '30px' }}>Our School</h4>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <Link to="/founders">Founders</Link>
                  <Link to="/admissions">Admissions</Link>
                  <Link to="/gallery">Gallery</Link>
                  <Link to="/login">Portal Dashboard</Link>
               </div>
            </div>
            <div className="footer-contact">
               <h4 style={{ marginBottom: '30px' }}>Get in Touch</h4>
               <p style={{ marginBottom: '16px' }}>📍 Jos North, Plateau State</p>
               <p style={{ marginBottom: '16px' }}>📞 +234 706 497 0003</p>
               <p>✉️ citadelofhighflyersintlacademy@gmail.com</p>
            </div>
         </div>
         <div className="footer-bottom" style={{ textAlign: 'center', padding: '30px 0', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
            <p>&copy; {new Date().getFullYear()} Citadel of Highflyers Int'l Academy. Built for Future Generals.</p>
         </div>
      </footer>
    </div>
  );
};

export default Home;
