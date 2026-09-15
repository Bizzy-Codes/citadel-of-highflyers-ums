import { MessageCircle, X, PhoneOff } from 'lucide-react';
import { whatsappLink, toWhatsAppNumber } from '../../lib/outreach';

export interface ParentContact {
  /** "Father", "Mother", "Pickup contact" */
  role: string;
  /** Their name, if we hold one. */
  name?: string;
  phone?: string;
}

interface ContactParentDialogProps {
  open: boolean;
  title: string;
  /** Shown above the list, e.g. what is about to be sent. */
  description?: string;
  contacts: ParentContact[];
  /** The WhatsApp message body. */
  message: string;
  onClose: () => void;
}

// Which parent should this go to?
//
// The school holds a number for the father, the mother and whoever
// collects the child, and in practice one of them is often out of
// service. Picking "the first one we have" silently sent messages into
// a dead number, so anything outbound asks first.
const ContactParentDialog = ({
  open, title, description, contacts, message, onClose,
}: ContactParentDialogProps) => {
  if (!open) return null;

  const reachable = contacts.filter((c) => toWhatsAppNumber(c.phone ?? '').length >= 10);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '20px' }}>
      <div className="glass animate-fade-in" style={{ background: 'var(--bg-surface)', padding: '28px', borderRadius: '24px', width: '100%', maxWidth: '440px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '6px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <MessageCircle size={20} /> {title}
          </h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {description && (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '18px' }}>{description}</p>
        )}

        {reachable.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 10px', color: 'var(--text-muted)' }}>
            <PhoneOff size={30} style={{ opacity: 0.3, marginBottom: '10px' }} />
            <p style={{ fontSize: '13px' }}>
              No phone number is on file for this pupil. Add one on their profile first.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {reachable.map((c) => (
              <a
                key={`${c.role}-${c.phone}`}
                href={whatsappLink(toWhatsAppNumber(c.phone!), message)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                  padding: '14px 16px', borderRadius: '14px', textDecoration: 'none',
                  border: '2px solid var(--glass-border)', background: 'var(--bg-light)', color: 'var(--text-main)',
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', fontSize: '14px' }}>
                    {c.role}{c.name ? ` — ${c.name}` : ''}
                  </strong>
                  <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>{c.phone}</span>
                </span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0,
                  padding: '7px 13px', borderRadius: '50px', background: '#25D366', color: '#fff',
                  fontSize: '12.5px', fontWeight: 700,
                }}>
                  <MessageCircle size={14} /> Send
                </span>
              </a>
            ))}
          </div>
        )}

        <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '16px' }}>
          WhatsApp opens with the message already written &mdash; you still press send.
        </p>
      </div>
    </div>
  );
};

export default ContactParentDialog;
