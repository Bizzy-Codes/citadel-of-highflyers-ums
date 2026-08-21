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
                   <h2>P.Ambassador (Mrs) <span>Iwunna Princess</span></h2>
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

          {/* Head Teacher: Ruth Sankira */}
          <section className="founder-section animate-fade-in">
             <div className="founder-content">
                <div className="founder-image-wrapper">
                   <div className="founder-card-bg"></div>
                   <PhotoSlot src="/gallery/founder-headteacher.jpg" alt="Ruth Sankira" label="Photo: Ruth Sankira" className="founder-img" />
                   <div className="founder-badge founder-1"><Sparkles size={16} /> Head Teacher</div>
                </div>
                <div className="founder-text">
                   <h2>Mrs <span>Ruth Sankira</span></h2>
                   <p className="founder-role">Head Teacher &amp; Head of Kindergarten, Staff Relations/Operations</p>
                   <div className="quote-box glass-purple">
                      <Quote className="quote-icon" />
                      <p>Every child deserves a teacher who sees their potential, and every teacher deserves a school that stands behind them -- that's the standard we hold ourselves to every day.</p>
                   </div>
                   <p className="description text-muted">
                      Ruth Sankira is one of Citadel of Highflyers' Management staff, having served the school for over 12 years with dedication and passion -- first as a classroom teacher, and later as Head Teacher. She presently serves as Head of Kindergarten and oversees Staff Relations and Operations, bringing more than a decade of hands-on experience to every child and colleague she works with.
                   </p>
                </div>
             </div>
          </section>

          {/* Administrative Officer: Ozoegwu Onyinye Claire */}
          <section className="founder-section reverse animate-fade-in">
             <div className="founder-content">
                <div className="founder-text">
                   <h2>Mrs <span>Ozoegwu Onyinye Claire</span></h2>
                   <p className="founder-role">Administrative Officer</p>
                   <div className="quote-box glass-purple">
                      <Quote className="quote-icon" />
                      <p>A well-run school is felt long before it's seen -- in every form filed correctly, every question answered promptly, and every family made to feel welcome.</p>
                   </div>
                   <p className="description text-muted">
                      As Administrative Officer, Ozoegwu Onyinye Claire manages the day-to-day administrative operations of Citadel of Highflyers -- from pupil records and correspondence to coordinating between parents, staff, and management. Her attention to detail and commitment to smooth, efficient operations keep the administrative backbone of the school running seamlessly, so teachers and pupils can focus on what matters most: learning and growth.
                   </p>
                </div>
                <div className="founder-image-wrapper">
                   <div className="founder-card-bg secondary"></div>
                   <PhotoSlot src="/gallery/founder-admin.jpg" alt="Ozoegwu Onyinye Claire" label="Photo: Ozoegwu Onyinye Claire" className="founder-img" />
                   <div className="founder-badge founder-2"><Sparkles size={16} /> Admin</div>
                </div>
             </div>
          </section>

          {/* School Club/Program Manager (SPC): Eggah Freeda */}
          <section className="founder-section animate-fade-in">
             <div className="founder-content">
                <div className="founder-image-wrapper">
                   <div className="founder-card-bg"></div>
                   <PhotoSlot src="/gallery/founder-spc.jpg" alt="Eggah Freeda" label="Photo: Eggah Freeda" className="founder-img" />
                   <div className="founder-badge founder-1"><Sparkles size={16} /> Program Manager</div>
                </div>
                <div className="founder-text">
                   <h2>Mrs <span>Eggah Freeda</span></h2>
                   <p className="founder-role">School Club/Program Manager (SPC)</p>
                   <div className="quote-box glass-purple">
                      <Quote className="quote-icon" />
                      <p>Beyond the classroom is where character truly comes alive -- through clubs, programs, and shared experiences that shape confident, well-rounded generals.</p>
                   </div>
                   <p className="description text-muted">
                      Eggah Freeda serves as the School Club/Program Manager (SPC) at Citadel of Highflyers, a role she has grown into over more than seven years of committed service to the school. She is passionate about creating enriching extracurricular experiences for every pupil, always going the extra mile to ensure the school's clubs and programs run smoothly and meaningfully.
                   </p>
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
