import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, Eye, Compass, Star, CheckCircle, GraduationCap, Baby, FileText, MessageCircle, ClipboardList,
} from 'lucide-react';
import { PROSPECTUS, SCHOOL_WHATSAPP, hasFile, whatsappLink } from '../../lib/outreach';
import './Founders.css';
import './Prospectus.css';

// The school prospectus, on the website. Built from what the school has
// already published (vision, mission, values, curriculum, classes, how to
// apply). No prices: fees are only shown inside the portal (the school's
// decision, 2026-09-28). When the scanned prospectus files are added to
// public/prospectus/ (see the README there), download buttons appear.

const TRUST = [
  'Godly / Moral Standard',
  'Minimum Number of Pupils in Class',
  'High Academic Standard',
  'Practical Usage of Diction',
  'Boldness, Confidence & Independence in Each Child',
  'Every Child to Be a Star',
];

const ARMS = [
  {
    key: 'kinders' as const,
    icon: <Baby size={22} />,
    title: 'Kindergarten',
    classes: ['Daycare', 'Reception', 'Kindergarten 1', 'Kindergarten 2'],
    blurb: 'Our youngest pupils, from Daycare through Kindergarten 2.',
  },
  {
    key: 'graders' as const,
    icon: <GraduationCap size={22} />,
    title: 'Graders',
    classes: ['Pre-Grade', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
    blurb: 'Our primary years, from Pre-Grade through Grade 5.',
  },
];

const STEPS = [
  'Fill the admission form online and upload any documents you have (birth certificate, immunisation record, last school report).',
  'Pay the application processing fee -- the admissions page shows you how, by cash at the school office or bank transfer.',
  'Send us a message on WhatsApp. Our admissions team will reply with the welcome pack and confirm your child\'s class.',
];

const Prospectus = () => {
  const [files, setFiles] = useState<Record<string, boolean>>({});

  // Only offer a download for a file that's actually been added.
  useEffect(() => {
    let cancelled = false;
    Promise.all(Object.entries(PROSPECTUS).map(async ([key, p]) => [key, await hasFile(p.file)] as const))
      .then((entries) => { if (!cancelled) setFiles(Object.fromEntries(entries)); });
    return () => { cancelled = true; };
  }, []);
  const downloads = Object.entries(PROSPECTUS).filter(([key]) => files[key]);

  return (
    <div className="founders-root prospectus-root">
      <nav className="founders-nav">
        <Link to="/" className="back-btn"><ArrowLeft size={20} /> Back to Home</Link>
        <div className="school-logo-small">
          <img src="/logo.jpg" alt="Logo" style={{ width: '32px', height: '32px', borderRadius: '50%', marginRight: '10px' }} />
          Citadel of Highflyers Int'l Academy
        </div>
      </nav>

      <header className="founders-header animate-fade-in">
        <span className="badge"><BookOpen size={14} style={{ marginRight: '6px' }} />Foundation for Future Generals</span>
        <h1>Our <span>Prospectus</span></h1>
        <p>Who we are, what we teach, and how to join the family of Highflyers.</p>
        {downloads.length > 0 && (
          <div className="prospectus-downloads">
            {downloads.map(([key, p]) => (
              <a key={key} href={p.file} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
                <FileText size={18} /> {p.label}
              </a>
            ))}
          </div>
        )}
      </header>

      <main className="container prospectus-main">
        <section className="prospectus-section">
          <div className="prospectus-vm">
            <div className="prospectus-card">
              <div className="prospectus-icon"><Eye size={24} /></div>
              <h2>Our Vision</h2>
              <p>We are poised to raise Godly future generals.</p>
            </div>
            <div className="prospectus-card">
              <div className="prospectus-icon"><Compass size={24} /></div>
              <h2>Our Mission</h2>
              <p>To create an enabling environment where children, through divine wisdom, are raised spiritually, socially, emotionally, morally, and academically to become future generals.</p>
            </div>
          </div>
        </section>

        <section className="prospectus-section">
          <h2 className="prospectus-title">Who We Are</h2>
          <p className="prospectus-lead">
            Citadel of Highflyers Int'l Academy is a co-educational private nursery and primary school at Rock Haven,
            opposite St. Murumba College, Jos. We blend academic rigour with a spiritual foundation, preparing every
            child for the battle of life -- with the fear of God, good character, and the confidence to lead.
          </p>
          <ul className="prospectus-list">
            <li><CheckCircle size={18} /> A British-Nigerian integrated curriculum, so pupils are globally competitive and rooted in local values</li>
            <li><CheckCircle size={18} /> STEM and digital literacy in every grade</li>
            <li><CheckCircle size={18} /> Small classes, so every child gets personal attention</li>
            <li><CheckCircle size={18} /> Teachers who are mentors, trained for each child's stage of development</li>
            <li><CheckCircle size={18} /> Digital tools and video resources that make learning fun and memorable</li>
            <li><CheckCircle size={18} /> Discipline, integrity and honour taught through faith</li>
          </ul>
        </section>

        <section className="prospectus-section">
          <h2 className="prospectus-title">Our Classes</h2>
          <div className="prospectus-arms">
            {ARMS.map((arm) => (
              <div key={arm.key} className="prospectus-card">
                <div className="prospectus-icon">{arm.icon}</div>
                <h3>{arm.title}</h3>
                <p>{arm.blurb}</p>
                <div className="prospectus-chips">
                  {arm.classes.map((c) => <span key={c}>{c}</span>)}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="prospectus-section">
          <h2 className="prospectus-title"><Star size={22} /> You Can Trust Us For</h2>
          <div className="prospectus-trust">
            {TRUST.map((t) => (
              <div key={t} className="prospectus-trust-item"><CheckCircle size={18} /> <span>{t}</span></div>
            ))}
          </div>
        </section>

        <section className="prospectus-section">
          <h2 className="prospectus-title"><ClipboardList size={22} /> How to Apply</h2>
          <ol className="prospectus-steps">
            {STEPS.map((s) => <li key={s}>{s}</li>)}
          </ol>
          <p className="prospectus-note">
            Fees and payment details are shared privately with families -- ask the school office, or log in to the portal.
          </p>
          <div className="prospectus-actions">
            <Link to="/admissions" className="btn btn-primary lg">Apply for Admission</Link>
            <a
              href={whatsappLink(SCHOOL_WHATSAPP, "Hello, I'd like to know more about Citadel of Highflyers Int'l Academy.")}
              target="_blank" rel="noopener noreferrer" className="btn btn-outline lg"
            >
              <MessageCircle size={18} /> Chat with Us on WhatsApp
            </a>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Prospectus;
