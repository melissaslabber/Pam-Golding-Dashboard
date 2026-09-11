import "../legal-pages.css";

export const metadata = { title: "Data Deletion | Pam Golding Rentals Organiser" };

export default function DataDeletion() {
  return <main className="legal-shell"><article className="legal-page">
    <header className="legal-brand"><img src="/pam-golding-gate.jpg" alt="Pam Golding Properties"/><div><strong>Pam Golding Rentals Organiser</strong><span>DATA AND ACCOUNT SUPPORT</span></div></header>
    <h1>Data Deletion Instructions</h1><p className="legal-date">Effective date: 10 September 2026</p>
    <h2>Disconnect Google Calendar</h2><p>Open the App, go to your personal calendar area and select <b>Disconnect</b>. You can also remove access from your Google Account under Security → Third-party apps and services. Disconnecting stops future access to Google Calendar and removes the App’s stored Google authorization token from that browser.</p>
    <h2>Request account or stored-data deletion</h2><p>Email <a href="mailto:melissa.slabber@gmail.com?subject=Pam%20Golding%20Rentals%20Organiser%20data%20deletion%20request">melissa.slabber@gmail.com</a> with the subject “Pam Golding Rentals Organiser data deletion request”. Include your full name, work email address and the team profile concerned so the request can be verified.</p>
    <h2>What happens next</h2><p>After identity and authority have been verified, App account data and operational records associated solely with the requester will be deleted or anonymised where reasonably possible. Confirmation will be sent when the request has been completed.</p>
    <h2>Records that may be retained</h2><p>Some property, application, compliance, contractual or business records may need to be retained where required by South African law, company policy, a legal claim or legitimate record-keeping obligations. Where deletion is not permitted, access will remain restricted and the information will be retained only for the required period.</p>
    <a className="legal-back" href="/about">Return to App information</a>
  </article></main>;
}
