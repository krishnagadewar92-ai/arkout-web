import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, CheckCircle2, CreditCard, FileText, Mail,
  MessageCircle, Printer, QrCode, ShieldCheck, SlidersHorizontal, UploadCloud,
} from "lucide-react";

const heroImage = "/WhatsApp Image 2026-09-20 at 11.30.43 PM (2).jpeg";

const workflowSteps = [
  { number: "01", title: "Connect", description: "Scan the kiosk QR code or enter the PIN shown on the terminal.", image: "/WhatsApp Image 2026-09-20 at 11.30.43 PM (2).jpeg", icon: QrCode },
  { number: "02", title: "Upload", description: "Choose your document and let the print flow prepare it.", image: "/WhatsApp Image 2026-09-20 at 11.30.43 PM (1).jpeg", icon: UploadCloud },
  { number: "03", title: "Choose", description: "Review page count, colour mode, copies and available layout options.", image: "/WhatsApp Image 2026-09-20 at 11.30.44 PM.jpeg", icon: SlidersHorizontal },
  { number: "04", title: "Pay & collect", description: "Complete checkout and follow the kiosk's on-screen instructions.", image: "/WhatsApp Image 2026-09-20 at 11.30.42 PM (1).jpeg", icon: CreditCard },
];

const campusFeatures = [
  { number: "01", title: "Made for busy campus days.", body: "A self-service path from your own device to a physical print, designed to feel straightforward from the first tap.", icon: Printer },
  { number: "02", title: "Know your choices before checkout.", body: "Review the available print options and the displayed total before you complete payment.", icon: SlidersHorizontal },
  { number: "03", title: "Designed around each session.", body: "PIN and QR-based entry help connect the online workflow to the kiosk you're using.", icon: ShieldCheck },
];

export default function ArkoutLandingPage() {
  return (
    <main className="arkout-site" id="top">
      <div className="site-announcement">
        <span className="site-announcement-dot" aria-hidden="true" />
        <span>Now live at Pemraj Sarda College</span>
        <span className="site-announcement-separator" aria-hidden="true">·</span>
        <a href="#campuses">Discover Arkout <ArrowRight size={13} aria-hidden="true" /></a>
      </div>

      <header className="site-header">
        <div className="site-header-inner">
          <Link className="site-brand" href="/" aria-label="Arkout home">
            <Image src="/arkout-logo.png" alt="" width={42} height={42} priority className="site-brand-logo" />
            <span>arkout</span>
          </Link>
          <nav className="site-nav-links" aria-label="Main navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#why-arkout">Why Arkout</a>
            <a href="#campuses">For campuses</a>
          </nav>
          <Link className="site-nav-cta" href="/print">Start printing <ArrowUpRight size={16} aria-hidden="true" /></Link>
        </div>
      </header>

      <section className="site-hero" aria-labelledby="hero-title">
        <div className="site-hero-copy">
          <p className="site-eyebrow"><span className="site-eyebrow-dot" /> CAMPUS PRINTING, REIMAGINED</p>
          <h1 id="hero-title">Your work.<br />On paper.<br /><span>Without the wait.</span></h1>
          <p className="site-hero-description">
            A calmer way to print on campus. Choose your documents, review the details, and move from screen to paper through one simple flow.
          </p>
          <div className="site-hero-actions">
            <Link className="site-button site-button-primary" href="/print">Start printing <ArrowRight size={17} aria-hidden="true" /></Link>
            <a className="site-button site-button-secondary" href="#campuses">Bring Arkout to campus</a>
          </div>
          <div className="site-hero-assurance"><ShieldCheck size={17} aria-hidden="true" /><span>Clear print choices · Session-based access · Online checkout</span></div>
        </div>

        <div className="site-hero-art" aria-label="Preview of the Arkout printing experience">
          <div className="site-hero-glow" aria-hidden="true" />
          <div className="site-hero-orbit site-hero-orbit-one" aria-hidden="true" />
          <div className="site-hero-orbit site-hero-orbit-two" aria-hidden="true" />
          <div className="site-device">
            <div className="site-device-top">
              <span className="site-device-lights"><i /><i /><i /></span>
              <span>ARKOUT PRINTPOD</span>
              <span className="site-device-menu">•••</span>
            </div>
            <div className="site-device-screen">
              <Image src={encodeURI(heroImage)} alt="A screen from the Arkout kiosk workflow" width={540} height={900} priority sizes="(max-width: 780px) 72vw, 340px" className="site-hero-screen-image" />
            </div>
            <div className="site-device-caption"><span className="site-device-status" />A simpler print flow</div>
          </div>
          <div className="site-float-card site-float-card-top">
            <span className="site-float-icon site-float-icon-blue"><QrCode size={19} aria-hidden="true" /></span>
            <span className="site-float-copy"><strong>One simple start</strong><small>Scan or enter your PIN</small></span>
          </div>
          <div className="site-float-card site-float-card-bottom">
            <span className="site-float-icon site-float-icon-green"><CheckCircle2 size={19} aria-hidden="true" /></span>
            <span className="site-float-copy"><strong>Review, then print</strong><small>See options before checkout</small></span>
          </div>
        </div>
      </section>

      <section className="site-proof-strip" aria-label="Arkout highlights">
        <div className="site-proof-item"><QrCode size={19} aria-hidden="true" /><span>QR and PIN access</span></div>
        <span className="site-proof-divider" aria-hidden="true" />
        <div className="site-proof-item"><FileText size={19} aria-hidden="true" /><span>Document-first workflow</span></div>
        <span className="site-proof-divider" aria-hidden="true" />
        <div className="site-proof-item"><CreditCard size={19} aria-hidden="true" /><span>Online checkout</span></div>
      </section>

      <section id="how-it-works" className="site-section site-workflow">
        <div className="site-section-heading">
          <p className="site-kicker">A FEW CLEAR STEPS</p>
          <h2>From screen to paper.<br /><span>Made to feel simple.</span></h2>
          <p>Everything begins with the kiosk in front of you. Here's how the Arkout flow comes together.</p>
        </div>
        <div className="site-step-grid">
          {workflowSteps.map((step) => {
            const Icon = step.icon;
            return (
              <article key={step.number} className="site-step-card">
                <div className="site-step-meta"><span>{step.number}</span><Icon size={19} aria-hidden="true" /></div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
                <div className="site-step-image-wrap">
                  <Image src={encodeURI(step.image)} alt={step.title + " step of the Arkout workflow"} width={440} height={740} sizes="(max-width: 640px) 86vw, (max-width: 1000px) 42vw, 22vw" className="site-step-image" />
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section id="why-arkout" className="site-campus-section">
        <div className="site-campus-panel">
          <div className="site-campus-heading">
            <p className="site-kicker site-kicker-light">BUILT AROUND CAMPUS LIFE</p>
            <h2>Less time managing a print job.<br /><span>More time for what’s next.</span></h2>
            <p>Arkout brings a digital-first workflow to an everyday campus need—without making the process feel complicated.</p>
          </div>
          <div className="site-feature-grid">
            {campusFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <article className="site-feature-card" key={feature.number}>
                  <div className="site-feature-card-top"><Icon size={22} aria-hidden="true" /><span>{feature.number}</span></div>
                  <h3>{feature.title}</h3>
                  <p>{feature.body}</p>
                </article>
              );
            })}
          </div>
          <div className="site-campus-footnote"><ShieldCheck size={18} aria-hidden="true" /><span>Available capabilities can vary by terminal. The checkout screen shows the options supported by the kiosk you're using.</span></div>
        </div>
      </section>

      <section id="campuses" className="site-partner-section">
        <div className="site-partner-copy">
          <p className="site-kicker">FOR INSTITUTIONS</p>
          <h2>Bring a more considered print experience to your campus.</h2>
          <p>Let's talk about your space, student needs, hardware setup, and what a campus pilot could look like.</p>
          <a className="site-button site-button-primary" href="mailto:contact@arkout.in">Talk with Arkout <ArrowUpRight size={17} aria-hidden="true" /></a>
        </div>
        <div className="site-partner-visual" aria-hidden="true">
          <div className="site-partner-ring site-partner-ring-one" />
          <div className="site-partner-ring site-partner-ring-two" />
          <div className="site-partner-mark"><Image src="/arkout-logo.png" alt="" width={84} height={84} className="site-partner-logo" /></div>
          <span className="site-partner-tag">A smoother campus essential.</span>
        </div>
      </section>

      <section id="contact" className="site-contact-section">
        <div className="site-contact-heading">
          <p className="site-kicker">LET'S CONNECT</p>
          <h2>Have a campus in mind?</h2>
          <p>For deployments, hardware questions, or partnership proposals, our team is one message away.</p>
        </div>
        <div className="site-contact-grid">
          <a className="site-contact-card" href="mailto:contact@arkout.in">
            <span className="site-contact-icon"><Mail size={24} aria-hidden="true" /></span>
            <span className="site-contact-card-title">Email our team</span>
            <span className="site-contact-card-detail">contact@arkout.in</span>
            <span className="site-contact-card-arrow"><ArrowUpRight size={17} aria-hidden="true" /></span>
          </a>
          <a className="site-contact-card" href="https://wa.me/917758820337" target="_blank" rel="noopener noreferrer">
            <span className="site-contact-icon site-contact-icon-green"><MessageCircle size={24} aria-hidden="true" /></span>
            <span className="site-contact-card-title">Chat on WhatsApp</span>
            <span className="site-contact-card-detail">Quick questions and support</span>
            <span className="site-contact-card-arrow"><ArrowUpRight size={17} aria-hidden="true" /></span>
          </a>
        </div>
      </section>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <Link className="site-brand site-brand-footer" href="/"><Image src="/arkout-logo.png" alt="" width={30} height={30} className="site-brand-logo" /><span>arkout</span></Link>
          <p>Campus printing, made simpler.</p>
          <span>© {new Date().getFullYear()} Arkout Techworks Pvt. Ltd.</span>
        </div>
        <div className="site-footer-bottom"><a href="#top">Back to top ↑</a><span>Designed for the details.</span></div>
      </footer>
    </main>
  );
}
