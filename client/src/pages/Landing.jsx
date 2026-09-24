import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../hooks.js';
import { PRINTER_BRANDS } from '../lib.js';
import './landing.css';

const COLS = 26;
const ROWS = 12;

// A small line-art printer. The output page lives in a nested <svg>, which clips it
// so it appears to slide out of the paper slot.
function Printer({ className = '', style, label }) {
  return (
    <svg className={`lp-printer ${className}`} style={style} viewBox="0 0 48 48" aria-hidden={!label} role={label ? 'img' : undefined}>
      {label && <title>{label}</title>}
      <rect className="p-feed" x="14" y="5" width="20" height="11" rx="1" />
      <rect className="p-body" x="5" y="14" width="38" height="16" rx="3.5" />
      <rect className="p-slot" x="11" y="26" width="26" height="2" rx="1" />
      <circle className="p-led" cx="37" cy="19.5" r="1.8" />
      <rect className="p-btn" x="9" y="18.5" width="7" height="2" rx="1" />
      <svg x="13" y="27" width="22" height="20" overflow="hidden">
        <g className="p-page">
          <rect x="1" y="0" width="20" height="18" rx="1" />
          <line x1="4" y1="5" x2="17" y2="5" />
          <line x1="4" y1="9" x2="15" y2="9" />
          <line x1="4" y1="13" x2="12" y2="13" />
        </g>
      </svg>
    </svg>
  );
}

function PrinterMatrix() {
  const cells = useMemo(() => {
    const out = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        // mostly a diagonal wave, with some printers firing at random so it feels alive
        const random = Math.random() < 0.22;
        const delay = random ? Math.random() * 7 : ((r + c) * 0.18) % 7;
        out.push({ key: `${r}-${c}`, delay: delay.toFixed(2), idle: Math.random() < 0.12 });
      }
    }
    return out;
  }, []);
  return (
    <div className="lp-matrix" style={{ '--cols': COLS }} aria-hidden="true">
      {cells.map((c) => (
        <Printer key={c.key} className={c.idle ? 'idle' : ''} style={{ '--d': `${c.delay}s` }} />
      ))}
    </div>
  );
}

function HeroPrinter() {
  return (
    <div className="lp-hero-printer" aria-hidden="true">
      <div className="hp-glow" />
      <svg viewBox="0 0 240 230" className="hp-svg">
        <defs>
          <linearGradient id="hpBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3b82f6" />
            <stop offset="1" stopColor="#1d4ed8" />
          </linearGradient>
        </defs>
        {/* paper feed */}
        <rect x="60" y="8" width="120" height="60" rx="4" fill="#e2e8f0" />
        <rect x="70" y="20" width="80" height="4" rx="2" fill="#cbd5e1" />
        <rect x="70" y="30" width="60" height="4" rx="2" fill="#cbd5e1" />
        {/* body */}
        <rect x="16" y="56" width="208" height="92" rx="16" fill="url(#hpBody)" />
        <rect x="16" y="56" width="208" height="20" rx="10" fill="#60a5fa" opacity="0.35" />
        <rect x="34" y="88" width="40" height="10" rx="5" fill="#1e3a8a" />
        <circle className="hp-led" cx="196" cy="92" r="7" />
        <rect x="48" y="126" width="144" height="8" rx="4" fill="#0f172a" />
        {/* output page */}
        <svg x="54" y="130" width="132" height="100" overflow="hidden">
          <g className="hp-page">
            <rect x="0" y="0" width="132" height="96" rx="4" fill="#fff" />
            <rect x="14" y="16" width="70" height="7" rx="3.5" fill="#cbd5e1" />
            <rect x="14" y="30" width="96" height="5" rx="2.5" fill="#e2e8f0" />
            <rect x="14" y="40" width="84" height="5" rx="2.5" fill="#e2e8f0" />
            <circle cx="36" cy="72" r="12" fill="#22c55e" />
            <path d="M30 72 l4.5 4.5 L43 67" stroke="#fff" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <text x="56" y="77" fontSize="15" fontWeight="700" fill="#166534" fontFamily="inherit">
              Repaired
            </text>
          </g>
        </svg>
      </svg>
      <div className="hp-chip hp-chip-1">
        <span className="dot green" /> Ready for pickup
      </div>
      <div className="hp-chip hp-chip-2">
        <span className="dot amber" /> Quote approved
      </div>
      <div className="hp-chip hp-chip-3">
        <span className="dot blue" /> Technician assigned
      </div>
    </div>
  );
}

const SERVICES = [
  { icon: '🛠', title: 'Repair', text: 'Paper jams, error codes, streaks, feed problems, connection issues. We find the cause and fix it.' },
  { icon: '🧽', title: 'Preventive maintenance', text: 'Scheduled cleaning, inspection and parts checks so your printers keep working.' },
  { icon: '📍', title: 'On-site service', text: 'Office printers and copiers serviced where they are, at a time that suits you.' },
  { icon: '🔌', title: 'Setup & installation', text: 'New units unboxed, connected to your network and set up on your computers.' },
];

const STEPS = [
  { n: 1, title: 'Send a request', text: 'Tell us the brand, model, serial number and what’s wrong. It takes about 2 minutes.' },
  { n: 2, title: 'We schedule it', text: 'We confirm a date for drop-off, pickup or an on-site visit.' },
  { n: 3, title: 'Approve the quote online', text: 'You see the itemized cost first. Nothing is repaired until you approve.' },
  { n: 4, title: 'Track until it’s done', text: 'Follow every update on your status link until your printer is ready.' },
];

export default function Landing() {
  const shop = useSettings().data;
  const heroRef = useRef(null);
  const name = shop?.name || 'PixPrint Repair Center';

  // fade sections in as they scroll into view
  useEffect(() => {
    const els = document.querySelectorAll('.lp-reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.15 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // cursor spotlight over the printer matrix
  const onMove = (e) => {
    const el = heroRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  return (
    <div className="lp">
      <header className="lp-nav">
        <Link to="/" className="lp-logo">
          <span className="lp-logo-mark">🖨</span>
          {name}
        </Link>
        <nav>
          <a href="#services">Services</a>
          <a href="#how">How it works</a>
          <Link to="/track">Track repair</Link>
          <Link to="/request" className="lp-btn lp-btn-sm">
            Request service
          </Link>
        </nav>
      </header>

      <section className="lp-hero" ref={heroRef} onMouseMove={onMove}>
        <PrinterMatrix />
        <div className="lp-spot" />
        <div className="lp-fade" />
        <div className="lp-hero-inner">
          <div className="lp-hero-copy">
            <span className="lp-eyebrow">
              <span className="pulse" /> Printer repair & maintenance
            </span>
            <h1>
              Printer down?
              <br />
              <span className="lp-grad">We’ll get it printing again.</span>
            </h1>
            <p className="lp-lead">
              Fast, reliable repair for inkjet, laser and office copiers from every major brand. Request service online, approve the
              quote before we start, and follow the repair live.
            </p>
            <div className="lp-ctas">
              <Link to="/request" className="lp-btn lp-btn-lg">
                Request a repair →
              </Link>
              <Link to="/track" className="lp-btn lp-btn-lg lp-btn-ghost">
                Track my repair
              </Link>
            </div>
            <ul className="lp-trust">
              <li>✓ You approve the cost first</li>
              <li>✓ Drop-off, pickup or on-site</li>
              <li>✓ Live status updates</li>
            </ul>
          </div>
          <HeroPrinter />
        </div>
      </section>

      <div className="lp-marquee" aria-label="Brands we service">
        <div className="lp-marquee-mask">
          <div className="lp-marquee-track">
          {[...PRINTER_BRANDS, ...PRINTER_BRANDS].map((b, i) => (
            <span key={i}>{b}</span>
          ))}
        </div>
        </div>
      </div>

      <section className="lp-section" id="services">
        <h2>What we do</h2>
        <p className="lp-sub">From one home printer to a whole office fleet.</p>
        <div className="lp-cards">
          {SERVICES.map((s, i) => (
            <div className="lp-card lp-reveal" key={s.title} style={{ '--i': i }}>
              <div className="lp-card-icon">{s.icon}</div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section lp-how" id="how">
        <h2>How it works</h2>
        <p className="lp-sub">No phone calls needed. Everything happens from one link.</p>
        <ol className="lp-steps">
          {STEPS.map((s) => (
            <li key={s.n} className="lp-reveal" style={{ '--i': s.n }}>
              <span className="lp-step-n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="lp-cta">
        <div className="lp-cta-printers" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <Printer key={i} style={{ '--d': `${i * 0.5}s` }} />
          ))}
        </div>
        <h2>Ready to fix your printer?</h2>
        <p>Send your request now and we’ll get back to you with a schedule.</p>
        <Link to="/request" className="lp-btn lp-btn-lg lp-btn-light">
          Request service now →
        </Link>
        {shop?.phone && (
          <p className="lp-cta-phone">
            Prefer to call? <a href={`tel:${shop.phone}`}>{shop.phone}</a>
          </p>
        )}
      </section>

      <footer className="lp-footer">
        <div>
          <strong>{name}</strong>
          {[shop?.address, shop?.phone, shop?.email].filter(Boolean).map((x) => (
            <div key={x}>{x}</div>
          ))}
        </div>
        <div className="lp-footer-links">
          <Link to="/request">Request service</Link>
          <Link to="/track">Track a repair</Link>
          <Link to="/login">Staff sign in</Link>
        </div>
      </footer>
    </div>
  );
}
