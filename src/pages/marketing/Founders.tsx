import { ArrowLeft, Quote, Award, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import PhotoSlot from '../../components/common/PhotoSlot';
import './Founders.css';

// This whole file is plain text/JSX -- edit any of the headings,
// quotes, bio paragraphs, or awards directly below to update the
// page copy. Photos come from public/gallery/ (see GALLERY.md there
// for the full filename list).
const Founders = () => {
  return (
    <div className="founders-root">
       <nav className="founders-nav">
          <Link to="/" className="back-btn"><ArrowLeft size={20} /> Back to Home</Link>
          <div className="school-logo-small">
              <img src="/logo.jpg" alt="Logo" style={{ width: '32px', height: '32px', borderRadius: '50%', marginRight: '10px' }} />
              Citadel of Highflyers Int'l Academy
          </div>
       </nav>

       <header className="founders-header animate-fade-in">
          <span className="badge">Visionaries & Leadership</span>
          <h1>The Hearts Behind The <span>Mission</span></h1>
          <p>Guided by faith and excellence, our leaders are dedicated to nurturing the next generation of global generals.</p>
       </header>

       <main className="founders-main container">
          {/* Founder: Chrispraise Iwunna */}
          <section className="founder-section animate-fade-in">
             <div className="founder-content">
                <div className="founder-image-wrapper">
                   <div className="founder-card-bg"></div>
                   <PhotoSlot src="/gallery/founder-chrispraise.jpg" alt="Pastor Chrispraise Iwunna" label="Photo: Pastor Chrispraise Iwunna" className="founder-img" />
                   <div className="founder-badge founder-1"><Sparkles size={16} /> Founder</div>
                </div>
                <div className="founder-text">
                   <h2>Pastor Ambassador <span>Chrispraise Iwunna</span></h2>
                   <p className="founder-role">Founder & Visionary</p>
                   <div className="quote-box glass-purple">
                      <Quote className="quote-icon" />
                      <p>Our vision is to build a foundation where every child is not just a pupil, but a 'Future General' equipped with character, competence, and compassion.</p>
                   </div>
                   <p className="description text-muted">
                      Pastor Ambassador Chrispraise Iwunna is a spiritual leader and a visionary dedicated to educational excellence in Jos North. With years of experience in youth mentorship and leadership, his focus at Citadel of Highflyers is to ensure that every pupil discovers their divine potential...
                   </p>
                   <div className="founder-awards">
                      <div className="award-item"><Award size={18} /> Leadership Excellence 2023</div>
                      <div className="award-item"><Award size={18} /> Community Impact Award</div>
                   </div>
                </div>
             </div>
          </section>

          {/* Proprietress: Iwunna Princess */}
          <section className="founder-section reverse animate-fade-in" style={{ animationDelay: '0.2s' }}>
             <div className="founder-content">
                <div className="founder-text">
                   <h2>Ambassador Mrs <span>Iwunna Princess</span></h2>
                   <p className="founder-role">Proprietress & Lead Educator</p>
                   <div className="quote-box glass-purple">
                      <Quote className="quote-icon" />
                      <p>At Citadel, we believe in the 'Total Child'. We nurture the mind, the heart, and the hands to create a holistic learning experience.</p>
                   </div>
                   <p className="description text-muted">
                      Ambassador Mrs. Iwunna Princess is the heart of Citadel's operations. Her passion for early childhood education and primary school development has made Citadel of Highflyers a top-tier institution in Jos. She oversees the day-to-day academic and emotional well-being of every pupil...
                   </p>
                   <div className="founder-actions">
                      <a href="https://www.instagram.com/princess_iwunna_321" target="_blank" rel="noopener noreferrer" className="btn btn-outline sm">Follow on Instagram @princess_iwunna_321</a>
                   </div>
                </div>
                <div className="founder-image-wrapper">
                   <div className="founder-card-bg secondary"></div>
                   <PhotoSlot src="/gallery/founder-princess.jpg" alt="Ambassador Mrs Iwunna Princess" label="Photo: Ambassador Mrs Iwunna Princess" className="founder-img" />
                   <div className="founder-badge founder-2"><Sparkles size={16} /> Proprietress</div>
                </div>
             </div>
          </section>

          {/* Head Teacher -- EDIT ME: replace the placeholder name, role,
              quote, and bio paragraph below with the real details. Save a
              photo to public/gallery/founder-headteacher.jpg to replace
              the placeholder tile. */}
          <section className="founder-section animate-fade-in">
             <div className="founder-content">
                <div className="founder-image-wrapper">
                   <div className="founder-card-bg"></div>
                   <PhotoSlot src="/gallery/founder-headteacher.jpg" alt="Head Teacher" label="Photo: Head Teacher" className="founder-img" />
                   <div className="founder-badge founder-1"><Sparkles size={16} /> Head Teacher</div>
                </div>
                <div className="founder-text">
                   <h2>[Head Teacher <span>Full Name</span>]</h2>
                   <p className="founder-role">Head Teacher</p>
                   <div className="quote-box glass-purple">
                      <Quote className="quote-icon" />
                      <p>[A short quote from the Head Teacher about their approach to teaching and school life.]</p>
                   </div>
                   <p className="description text-muted">
                      [A paragraph introducing the Head Teacher -- background, experience, and what they bring to Citadel of Highflyers.]
                   </p>
                </div>
             </div>
          </section>

          {/* Admin -- EDIT ME: same as above. Photo goes at
              public/gallery/founder-admin.jpg. */}
          <section className="founder-section reverse animate-fade-in">
             <div className="founder-content">
                <div className="founder-text">
                   <h2>[Admin <span>Full Name</span>]</h2>
                   <p className="founder-role">Administrator</p>
                   <div className="quote-box glass-purple">
                      <Quote className="quote-icon" />
                      <p>[A short quote from the Admin about running the school day-to-day.]</p>
                   </div>
                   <p className="description text-muted">
                      [A paragraph introducing the Admin -- background, experience, and their role at Citadel of Highflyers.]
                   </p>
                </div>
                <div className="founder-image-wrapper">
                   <div className="founder-card-bg secondary"></div>
                   <PhotoSlot src="/gallery/founder-admin.jpg" alt="Admin" label="Photo: Admin" className="founder-img" />
                   <div className="founder-badge founder-2"><Sparkles size={16} /> Admin</div>
                </div>
             </div>
          </section>
       </main>

       <footer className="founders-footer">
          <div className="footer-blob"></div>
          <p>&copy; {new Date().getFullYear()} Citadel of Highflyers Int'l Academy. The Foundation for Future Generals.</p>
       </footer>
    </div>
  );
};

export default Founders;
