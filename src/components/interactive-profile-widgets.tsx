import type { ProfileWidgets, ProfileWidgetKind } from "@/lib/profile-widgets";
import { GuestbookWidget } from "./guestbook-widget";
import { PollWidget } from "./poll-widget";

export function InteractiveProfileWidgets({ widgets, username, preview = false }: {
  widgets: ProfileWidgets; username: string; preview?: boolean;
}) {
  const active = widgets.order.filter((kind) => widgets[kind].enabled);
  if (active.length === 0) return null;
  return <div className="profile-widgets" aria-label="Interactive profile widgets">
    {active.map((kind: ProfileWidgetKind) => {
      if (kind === "guestbook") return preview
        ? <section className="profile-widget" key={kind}><h2>{widgets.guestbook.heading}</h2><p className="widget-preview-note">Visitor messages and moderation are available after publishing.</p></section>
        : <GuestbookWidget key={kind} username={username} heading={widgets.guestbook.heading}
            description={widgets.guestbook.description} maxEntries={widgets.guestbook.maxEntries}
            submissionsOpen={widgets.guestbook.submissionsOpen} />;
      if (kind === "testimonials") return <section className="profile-widget profile-testimonials" key={kind}>
        <h2>{widgets.testimonials.heading}</h2>
        <div className="testimonial-list">{widgets.testimonials.items.map((item) => <figure key={item.id}>
          <blockquote><p>{item.quote}</p></blockquote>
          <figcaption><strong>{item.author}</strong>{item.role && <span>{item.role}</span>}</figcaption>
        </figure>)}</div>
      </section>;
      if (kind === "poll") return preview
        ? <section className="profile-widget" key={kind}><h2>{widgets.poll.question || "Poll"}</h2><p className="widget-preview-note">Voting is available after publishing.</p></section>
        : <PollWidget key={widgets.poll.id} username={username} pollId={widgets.poll.id}
            question={widgets.poll.question} options={widgets.poll.options} open={widgets.poll.open}
            closesAt={widgets.poll.closesAt} showResultsBeforeVote={widgets.poll.showResultsBeforeVote} />;
      return <section className="profile-widget profile-faq" key={kind}>
        <h2>{widgets.faq.heading}</h2>
        {widgets.faq.items.map((item) => <details key={item.id}>
          <summary>{item.question}</summary><div className="profile-faq-answer"><p>{item.answer}</p></div>
        </details>)}
      </section>;
    })}
  </div>;
}
