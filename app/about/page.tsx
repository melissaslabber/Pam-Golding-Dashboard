import "../legal-pages.css";

export const metadata = { title: "Pam Golding Rentals Organiser" };

export default function About() {
  return <main className="legal-shell"><article className="legal-page">
    <header className="legal-brand"><img src="/pam-golding-gate.jpg" alt="Pam Golding Properties"/><div><strong>Pam Golding Rentals Organiser</strong><span>BOLAND · OVERBERG · CAPE REGION RENTALS</span></div></header>
    <h1>Rental work, organised in one place</h1>
    <p>The Pam Golding Rentals Organiser is a private workflow application for authorised rental staff. It brings daily appointments, tasks, property maintenance, lease renewals and new-lease compliance steps into one clear dashboard.</p>
    <h2>What the App does</h2><ul><li>Displays today’s calendar, priority tasks and urgent rental workflows.</li><li>Tracks maintenance matters from first report through completion.</li><li>Guides lease renewals and new leases through their required action points.</li><li>Allows linked agents and assistants to work from the same operational profile.</li><li>Provides property-specific tenant-application links and workflow reporting.</li></ul>
    <h2>Google Calendar integration</h2><p>Staff members may optionally connect their own Google Calendar. After a user grants permission, the App displays upcoming calendar events in that user’s dashboard and allows the user to create, edit or delete their own events from the App. The App requests only the Google Calendar event permission required for these features.</p>
    <h2>Who may use it</h2><p>The operational dashboard is restricted to authorised staff using a manager-issued access code. This public information page is available without signing in so users can understand the App before granting Google access.</p>
    <h2>Privacy and support</h2><p>Read the <a href="/privacy">Privacy Policy</a>, <a href="/terms">Terms of Service</a> and <a href="/data-deletion">Data Deletion Instructions</a>. Questions can be sent to <a href="mailto:melissa.slabber@gmail.com">melissa.slabber@gmail.com</a>.</p>
    <a className="legal-back" href="/">Open the secure App</a>
  </article></main>;
}
