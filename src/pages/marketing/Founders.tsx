import { ArrowLeft, Quote, Award, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import PhotoSlot from '../../components/common/PhotoSlot';
import './Founders.css';

// This whole file is plain text/JSX -- edit any of the headings,
// quotes, bio paragraphs, or awards directly below to update the
// page copy. Photos come from public/gallery/ (see GALLERY.md there
// for the full filename list).
//
// Structure: the two Founders come first, then a divider, then the
// "Leadership Team" -- the management staff who run the school day to
// day. To rename that group, change LEADERSHIP_SECTION_TITLE below.
const LEADERSHIP_SECTION_TITLE = 'The Leadership Team';

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
            {/* ============================================================
              FOUNDERS
              ============================================================ */}

            {/* Founder: Chrispraise Iwunna */}
            <section className="founder-section animate-fade-in">
               <div className="founder-content">
                  <div className="founder-image-wrapper">
                     <div className="founder-card-bg"></div>
                     <PhotoSlot src="/gallery/founder-chrispraise.jpg" alt="Pastor Chrispraise Iwunna" label="Photo: Pastor Chrispraise Iwunna" className="founder-img" />
                     <div className="founder-badge founder-1"><Sparkles size={16} /> Founder</div>
                  </div>
                  <div className="founder-text">
                     <h2>Pastor <span>Chrispraise Iwunna</span></h2>
                     <p className="founder-role">Founder & Visionary &middot; United Nations Peace Ambassador</p>
                     <div className="quote-box glass-purple">
                        <Quote className="quote-icon" />
                        <p>Our vision is to build a foundation where every child is not just a pupil, but a 'Future General' equipped with character, competence, and compassion.</p>
                     </div>
                     <p className="description text-muted">
                        Pastor Chrispraise Iwunna is a spiritual leader, visionary, and United Nations Peace Ambassador dedicated to educational excellence in Jos. With over 15 years of experience in family building and marriage coaching, alongside a deep, ongoing commitment to children's ministry, his focus at Citadel of Highflyers is to ensure that every pupil discovers their divine potential...
                     </p>
                     <div className="founder-awards">
                        <div className="award-item"><Award size={18} /> United Nations Peace Ambassador</div>
                        <div className="award-item"><Award size={18} /> 15+ Years in Family Building & Marriage Coaching</div>
                        <div className="award-item"><Award size={18} /> Children's Ministry Leadership</div>
                        <div className="award-item"><Award size={18} /> Leadership Excellence 2023</div>
                        <div className="award-item"><Award size={18} /> Community Impact Award</div>
                     </div>
                  </div>  
               </div>
            </section>

            {/* Founder: Iwunna Princess */}
            <section className="founder-section reverse animate-fade-in" style={{ animationDelay: '0.2s' }}>
               <div className="founder-content">
                  <div className="founder-text">
                     <h2>Ambassador <span>Iwunna Princess</span></h2>
                     <p className="founder-role">Proprietor & Lead Educator &middot; United Nations Peace Ambassador</p>
                     <div className="quote-box glass-purple">
                        <Quote className="quote-icon" />
                        <p>At Citadel, we believe in the 'Total Child'. We nurture the mind, the heart, and the hands to create a holistic learning experience.</p>
                     </div>
                     <p className="description text-muted">
                        Ambassador Iwunna Princess is the heart of Citadel's operations and a United Nations Peace Ambassador. She holds a Postgraduate Diploma in Education from the National Teachers' Institute, an International Diploma in Education from the University of Buckingham, and is TEFL and TOEFL certified, alongside a B.Sc. in Accountancy from Enugu State University of Science and Technology. Her passion for early childhood education and primary school development has made Citadel of Highflyers a top-tier institution in Jos. She oversees the day-to-day academic and emotional well-being of every pupil...
                     </p>
                     <div className="founder-awards">
                        <div className="award-item"><Award size={18} /> United Nations Peace Ambassador</div>
                        <div className="award-item"><Award size={18} /> International Diploma in Education - University of Buckingham, UK </div>
                        <div className="award-item"><Award size={18} /> Postgraduate Diploma in Education -- National Teachers' Institute</div>
                        <div className="award-item"><Award size={18} /> TEFL & TOEFL Certified</div>
                        <div className="award-item"><Award size={18} /> B.Sc. Accountancy -- Enugu State University of Science and Technology</div>
                     </div>
                     <div className="founder-actions">
                        <a href="https://www.instagram.com/princess_iwunna_321" target="_blank" rel="noopener noreferrer" className="btn btn-outline sm">Follow on Instagram @princess_iwunna_321</a>
                     </div>
                  </div>
                  <div className="founder-image-wrapper">
                     <div className="founder-card-bg secondary"></div>
                     <PhotoSlot src="/gallery/founder-princess.jpg?v=2" alt="Ambassador Iwunna Princess" label="Photo: Ambassador Iwunna Princess" className="founder-img" />
                     <div className="founder-badge founder-2"><Sparkles size={16} /> Proprietor</div>
                  </div>
               </div>
            </section>

            {/* ============================================================
              LEADERSHIP TEAM  (management staff -- not founders)
              ============================================================ */}
            <div className="leadership-divider animate-fade-in">
               <span className="badge">Management &amp; Operations</span>
               <h2>{LEADERSHIP_SECTION_TITLE}</h2>
               <p>The people who keep Citadel of Highflyers running every day leading classrooms, coordinating staff, and looking after every pupil and family.</p>
            </div>

            {/* Head Teacher: Ruth Sankira */}
            <section className="founder-section animate-fade-in">
               <div className="founder-content">
                  <div className="founder-image-wrapper">
                     <div className="founder-card-bg"></div>
                     <PhotoSlot src="/gallery/founder-headteacher.jpg" alt="Ruth Sankira" label="Photo: Ruth Sankira" className="founder-img" />
                     <div className="founder-badge founder-1"><Sparkles size={16} /> Head Teacher</div>
                  </div>
                  <div className="founder-text">
                     <h2><span>Ruth Sankira</span></h2>
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

            {/* HOD Graders Arm: Lene Temi */}
            <section className="founder-section reverse animate-fade-in">
               <div className="founder-content">
                  <div className="founder-text">
                     <h2><span>Lene Temi</span></h2>
                     <p className="founder-role">HOD, Graders Arm</p>
                     <div className="quote-box glass-purple">
                        <Quote className="quote-icon" />
                        <p>The Graders years are where habits, confidence, and a love of learning take root -- my job is to make sure every classroom in the arm delivers on that.</p>
                     </div>
                     <p className="description text-muted">
                        Lene Temi leads the Graders Arm at Citadel of Highflyers as Head of Department, overseeing academic standards, lesson delivery, and pupil progress across the primary grades. She works closely with class teachers to keep the curriculum consistent and rigorous, mentors newer staff, and keeps a close eye on how every child in the arm is doing -- academically and personally.
                     </p>
                  </div>
                  <div className="founder-image-wrapper">
                     <div className="founder-card-bg secondary"></div>
                     <PhotoSlot src="/gallery/staff-lene-temi.jpg" alt="Lene Temi" label="Photo: Lene Temi" className="founder-img" />
                     <div className="founder-badge founder-2"><Sparkles size={16} /> HOD Graders Arm</div>
                  </div>
               </div>
            </section>

            {/* Administrative Officer: Ozoegwu Onyinye Claire */}
            <section className="founder-section animate-fade-in">
               <div className="founder-content">
                  <div className="founder-image-wrapper">
                     <div className="founder-card-bg"></div>
                     <PhotoSlot src="/gallery/founder-admin.jpg" alt="Ozoegwu Onyinye Claire" label="Photo: Ozoegwu Onyinye Claire" className="founder-img" />
                     <div className="founder-badge founder-1"><Sparkles size={16} /> Admin</div>
                  </div>
                  <div className="founder-text">
                     <h2><span>Ozoegwu Onyinye Claire</span></h2>
                     <p className="founder-role">Administrative Officer</p>
                     <div className="quote-box glass-purple">
                        <Quote className="quote-icon" />
                        <p>A well-run school is felt long before it's seen -- in every form filed correctly, every question answered promptly, and every family made to feel welcome.</p>
                     </div>
                     <p className="description text-muted">
                        As Administrative Officer, Ozoegwu Onyinye Claire manages the day-to-day administrative operations of Citadel of Highflyers -- from pupil records and correspondence to coordinating between parents, staff, and management. Her attention to detail and commitment to smooth, efficient operations keep the administrative backbone of the school running seamlessly, so teachers and pupils can focus on what matters most: learning and growth.
                     </p>
                  </div>
               </div>
            </section>

            {/* School Club/Program Manager (SPC): Eggah Freeda */}
            <section className="founder-section reverse animate-fade-in">
               <div className="founder-content">
                  <div className="founder-text">
                     <h2><span>Eggah Freeda</span></h2>
                     <p className="founder-role">School Club/Program Manager (SPM)</p>
                     <div className="quote-box glass-purple">
                        <Quote className="quote-icon" />
                        <p>Beyond the classroom is where character truly comes alive -- through clubs, programs, and shared experiences that shape confident, well-rounded generals.</p>
                     </div>
                     <p className="description text-muted">
                        Eggah Freeda serves as the School Club/Program Manager (SPM) at Citadel of Highflyers, a role she has grown into over more than seven years of committed service to the school. She is passionate about creating enriching extracurricular experiences for every pupil, always going the extra mile to ensure the school's clubs and programs run smoothly and meaningfully.
                     </p>
                  </div>
                  <div className="founder-image-wrapper">
                     <div className="founder-card-bg secondary"></div>
                     <PhotoSlot src="/gallery/founder-spc.jpg" alt="Eggah Freeda" label="Photo: Eggah Freeda" className="founder-img" />
                     <div className="founder-badge founder-2"><Sparkles size={16} /> Program Manager</div>
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
