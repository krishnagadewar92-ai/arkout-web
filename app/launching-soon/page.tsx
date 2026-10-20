import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Printer } from "lucide-react";

export default function LaunchingSoonPage() {
  return (
    <main className="arkout-coming-soon">
      <div className="coming-soon-card">
        <div className="coming-soon-logo"><Printer size={25} aria-hidden="true" /></div>
        <p className="coming-soon-eyebrow">ARKOUT PRINTPOD</p>
        <h1>Online printing is on its way.</h1>
        <p>We're preparing a thoughtful, reliable online printing experience. For now, use the PIN or QR flow provided by your campus kiosk.</p>
        <Link href="/" className="site-button site-button-primary"><ArrowLeft size={17} aria-hidden="true" /> Back to Arkout</Link>
        <p className="coming-soon-footnote">Questions about bringing Arkout to your campus? <a href="mailto:contact@arkout.in">Talk to our team <ArrowUpRight size={13} aria-hidden="true" /></a></p>
      </div>
    </main>
  );
}
