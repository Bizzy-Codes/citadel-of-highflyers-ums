import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Printer, MessageCircle, Landmark, Shirt, Calculator, BellRing, CalendarDays } from 'lucide-react';
import { FEE_SCHEDULES, feeTotals, naira, SCHOOL_BANK } from '../../lib/feeSchedule';
import { sectionForClass, type SchoolSection } from '../../lib/accounts';
import './FinancialInvolvement.css';

// The school's Financial Involvement sheet, as a page rather than an
// image.
//
// It exists as a page because the school's actual problem is *sending*
// it: WhatsApp can't be made to attach a file automatically, but it
// will happily carry a link. So each arm gets its own permanent URL
// that can be pasted into a chat, opened on any phone, and printed or
// saved as PDF from there.
//
// /fees/kinders   -> Reception & Kindergarten
// /fees/graders   -> Pre-Grade / Graders
const FinancialInvolvement = () => {
  const { section: raw } = useParams();
  const section: SchoolSection =
    raw === 'graders' || raw === 'kinders' ? raw : sectionForClass(raw);
  const schedule = FEE_SCHEDULES[section];
  const { feesSubtotal, uniformsSubtotal, total } = feeTotals(schedule);

  return (
    <div className="fi-root">
      <div className="fi-actions">
        <Link to="/" className="btn btn-outline sm"><ArrowLeft size={16} /> Home</Link>
        <button className="btn btn-primary sm" onClick={() => window.print()}>
          <Printer size={16} /> Print / Save as PDF
        </button>
      </div>

      <article className="fi-sheet">
        <header className="fi-header">
          <img src="/logo.jpg" alt="" className="fi-logo" />
          <p className="fi-motto">Raising Future Generals</p>
          <h1>FINANCIAL INVOLVEMENT</h1>
          <p className="fi-subtitle">For New In-Take Into</p>
          <h2>{schedule.title}</h2>
          <div className="fi-stars">★ ★ ★ ★ ★</div>
        </header>

        <p className="fi-banner">Please find below the details of the bill in respect of your child / ward</p>

        <section className="fi-block">
          <h3 className="fi-block-title">Fee Summary</h3>
          <table className="fi-table">
            <thead>
              <tr><th className="fi-sn">S/N</th><th>Fee Detail</th><th className="fi-amt">Amount (₦)</th></tr>
            </thead>
            <tbody>
              <tr><td className="fi-sn">1.</td><td>Tuition</td><td className="fi-amt">{naira(schedule.tuition)}</td></tr>
              <tr><td className="fi-sn">2.</td><td>Registration / Development Fee</td><td className="fi-amt">{naira(schedule.registration)}</td></tr>
              <tr className="fi-subtotal">
                <td colSpan={2}>Subtotal <span>(Tuition &amp; Registration)</span></td>
                <td className="fi-amt">{naira(feesSubtotal)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <div className="fi-two-col">
          <section className="fi-block">
            <h3 className="fi-block-title"><Shirt size={15} /> Uniforms Breakdown</h3>
            <table className="fi-table">
              <tbody>
                {schedule.uniforms.map((u, i) => (
                  <tr key={u.label}>
                    <td className="fi-sn">{i + 1}.</td>
                    <td>{u.label}</td>
                    <td className="fi-amt">{naira(u.amount)}</td>
                  </tr>
                ))}
                <tr className="fi-subtotal">
                  <td colSpan={2}>Subtotal <span>(Uniforms)</span></td>
                  <td className="fi-amt">{naira(uniformsSubtotal)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <aside className="fi-note">
            <h4><CalendarDays size={15} /> Note</h4>
            <ul>
              <li>The above fee <strong>excludes books</strong>.</li>
              <li>Uniforms can be paid in <strong>two (2) instalments</strong> between 1st Term and 2nd Term.</li>
            </ul>
          </aside>
        </div>

        <section className="fi-total">
          <div>
            <Calculator size={20} />
            <div>
              <strong>Total Payable</strong>
              <span>(Tuition, Registration &amp; Uniforms)</span>
            </div>
          </div>
          <div className="fi-total-amount">₦{naira(total)}</div>
        </section>

        <section className="fi-block">
          <h3 className="fi-block-title"><BellRing size={15} /> Important Notes</h3>
          <ul className="fi-checklist">
            <li>All payments should be made to the bank account below.</li>
            <li>Send your payment receipt to the school WhatsApp number: <strong>{SCHOOL_BANK.receiptWhatsApp}</strong></li>
          </ul>
        </section>

        <section className="fi-two-col fi-bank-row">
          <div className="fi-block">
            <h3 className="fi-block-title"><Landmark size={15} /> Bank Details</h3>
            <div className="fi-bank">
              <p><span>Bank</span><strong>{SCHOOL_BANK.bank}</strong></p>
              <p><span>Account Name</span><strong>{SCHOOL_BANK.accountName}</strong></p>
              <p><span>Account Number</span><strong>{SCHOOL_BANK.accountNumber}</strong></p>
            </div>
          </div>

          <a
            className="fi-receipt"
            href={`https://wa.me/234${SCHOOL_BANK.receiptWhatsApp.replace(/^0/, '')}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle size={22} />
            <span className="fi-receipt-label">Send Payment Receipt To</span>
            <strong>{SCHOOL_BANK.receiptWhatsApp}</strong>
            <em>Thank you for partnering with us in raising future generals!</em>
          </a>
        </section>

        <footer className="fi-footer">★ &nbsp;Raising Future Generals in All Their Fields&nbsp; ★</footer>
      </article>
    </div>
  );
};

export default FinancialInvolvement;
