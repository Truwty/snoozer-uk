import Link from "next/link";
import { StatusAutoRefresh } from "@/components/status-auto-refresh";
import { getPublicStatusSnapshot } from "@/lib/status-snapshot";
import "./status.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "System status",
  description: "Live Snoozer service health, provider updates and incident history.",
};

const stateLabels = {
  operational: "Operational",
  degraded: "Degraded",
  outage: "Service disruption",
  maintenance: "Maintenance",
  unknown: "Unknown",
} as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

export default async function StatusPage() {
  const snapshot = await getPublicStatusSnapshot();
  const checkedAt = formatDate(snapshot.checkedAt);

  return (
    <main className="status-page">
      <div className="status-container">
        <header className="status-topbar">
          <Link className="status-brand" href="/" aria-label="Snoozer homepage">
            <span className="status-brand-mark" aria-hidden="true">☾</span>
            <span>Snoozer<span className="status-brand-domain">.uk</span></span>
          </Link>
          <nav className="status-nav" aria-label="Status navigation">
            <Link href="/">Home</Link>
            <Link href="/help">Help centre</Link>
            <a href="#incidents">Incident history</a>
          </nav>
          <span className="status-live-chip"><i aria-hidden="true" /> LIVE MONITORING</span>
        </header>

        <section className={"status-hero status-hero-" + snapshot.summary.state} aria-labelledby="status-title">
          <div className="status-hero-copy">
            <p className="status-eyebrow"><span aria-hidden="true">✳</span> SNOOZER / SYSTEM STATUS</p>
            <p className="status-summary-label">{snapshot.summary.label}</p>
            <h1 id="status-title">{snapshot.summary.title}</h1>
            <p className="status-hero-description">{snapshot.summary.description}</p>
            <StatusAutoRefresh checkedAt={checkedAt} />
          </div>
          <div className="status-hero-art" aria-hidden="true">
            <div className="status-orbit status-orbit-outer" />
            <div className="status-orbit status-orbit-inner" />
            <div className="status-orbit-core"><span>☾</span></div>
            <span className="status-orbit-dot status-orbit-dot-one" />
            <span className="status-orbit-dot status-orbit-dot-two" />
          </div>
        </section>

        <section className="status-section" aria-labelledby="status-services-title">
          <div className="status-section-heading">
            <div>
              <p className="status-eyebrow">LIVE SERVICE CHECKS</p>
              <h2 id="status-services-title">Core services</h2>
              <p>Current signals from Snoozer and the platforms it relies on.</p>
            </div>
            <span className="status-service-count">{snapshot.services.length} monitored components</span>
          </div>

          <div className="status-panel">
            <ul className="status-service-list">
              {snapshot.services.map((service) => (
                <li className="status-service" key={service.id}>
                  <span className="status-service-icon" aria-hidden="true">{service.icon}</span>
                  <div className="status-service-copy">
                    <h3>{service.name}</h3>
                    <p>{service.description}</p>
                  </div>
                  <div className="status-service-state">
                    <span className={"status-pill status-pill-" + service.state}>
                      <i aria-hidden="true" />
                      {stateLabels[service.state]}
                    </span>
                    {service.sourceUrl && (
                      <a href={service.sourceUrl} target="_blank" rel="noopener noreferrer">
                        {service.sourceLabel} ↗
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <p className="status-source-note">
              Provider indicators come from public provider status feeds. A provider reporting normal operation does not guarantee the health of Snoozer’s individual account or every feature.
            </p>
          </div>
        </section>

        <section className="status-section status-incidents-section" id="incidents" aria-labelledby="status-incidents-title">
          <div className="status-section-heading">
            <div>
              <p className="status-eyebrow">WHAT’S HAPPENED</p>
              <h2 id="status-incidents-title">Incident history</h2>
              <p>Updates raised by Snoozer’s scheduled production monitor.</p>
            </div>
            <span className="status-service-count">Latest 5 incidents</span>
          </div>

          <div className="status-panel status-incident-panel">
            {!snapshot.incidentFeed.available ? (
              <div className="status-empty-state">
                <span className="status-empty-icon" aria-hidden="true">◌</span>
                <h3>Incident history is temporarily unavailable.</h3>
                <p>The incident feed could not be reached. The live service checks above are independent.</p>
              </div>
            ) : snapshot.incidentFeed.incidents.length === 0 ? (
              <div className="status-empty-state">
                <span className="status-empty-icon" aria-hidden="true">✓</span>
                <h3>No reported incidents.</h3>
                <p>The production monitor has no recorded open or resolved alerts to show.</p>
              </div>
            ) : (
              <ol className="status-incident-list">
                {snapshot.incidentFeed.incidents.map((incident, index) => (
                  <li className="status-incident" key={incident.startedAt + "-" + index}>
                    <span className={"status-incident-marker status-incident-marker-" + incident.state} aria-hidden="true" />
                    <div className="status-incident-copy">
                      <div className="status-incident-heading">
                        <h3>{incident.state === "resolved" ? "Production issue resolved" : "Production issue being investigated"}</h3>
                        <span className={"status-incident-badge status-incident-badge-" + incident.state}>
                          {incident.state === "resolved" ? "Resolved" : "Investigating"}
                        </span>
                      </div>
                      <p>
                        {incident.state === "resolved"
                          ? "Automated monitoring confirmed recovery."
                          : "Automated monitoring detected an issue. Snoozer is investigating."}
                      </p>
                      <div className="status-incident-times">
                        <time dateTime={incident.startedAt}>Started {formatDate(incident.startedAt)}</time>
                        {incident.resolvedAt && <time dateTime={incident.resolvedAt}>Resolved {formatDate(incident.resolvedAt)}</time>}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        <section className="status-monitoring-note">
          <div className="status-monitoring-symbol" aria-hidden="true">⌁</div>
          <div>
            <h2>How this page is monitored</h2>
            <p>Live checks run whenever this page refreshes. Snoozer’s automated production probes also run hourly and publish an incident when a monitored route fails.</p>
          </div>
          <Link href="/help">Need help? Visit the Help centre <span aria-hidden="true">↗</span></Link>
        </section>

        <footer className="status-footer">
          <Link className="status-footer-brand" href="/">Snoozer<span>.uk</span></Link>
          <span>© {new Date().getFullYear()} Snoozer. All rights reserved.</span>
          <a href="mailto:snoozersupport@snoozer.uk">Contact support</a>
        </footer>
      </div>
    </main>
  );
}
