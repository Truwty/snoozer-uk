"use client";

import type { ProfileWidgets } from "@/lib/profile-widgets";

function newId() { return crypto.randomUUID(); }

export function ProfileWidgetsEditor({ value, onChange }: {
  value: ProfileWidgets;
  onChange: (next: ProfileWidgets) => void;
}) {
  function updateGuestbook(patch: Partial<ProfileWidgets["guestbook"]>) {
    onChange({ ...value, guestbook: { ...value.guestbook, ...patch } });
  }
  function updateTestimonials(patch: Partial<ProfileWidgets["testimonials"]>) {
    onChange({ ...value, testimonials: { ...value.testimonials, ...patch } });
  }
  function updateFaq(patch: Partial<ProfileWidgets["faq"]>) {
    onChange({ ...value, faq: { ...value.faq, ...patch } });
  }
  function updatePoll(patch: Partial<ProfileWidgets["poll"]>, resetVotes = false) {
    onChange({ ...value, poll: { ...value.poll, ...patch, ...(resetVotes ? { id: newId() } : {}) } });
  }
  function moveWidget(index: number, direction: -1 | 1) {
    const next = [...value.order];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ ...value, order: next });
  }

  return <div className="profile-widgets-editor stack">
    <div className="panel stack">
      <h2>Interactive widgets</h2>
      <p className="muted">Add visitor interactions and profile content. Changes are saved with your draft and only appear publicly after publishing.</p>
      <p className="muted">Each profile can use one Guestbook, Testimonials collection, Poll and FAQ. Basic widgets are available on every Snoozer plan.</p>
      <h3>Display order</h3>
      <ol className="widget-order-list">
        {value.order.map((kind, index) => <li key={kind}>
          <span>{index + 1}. {kind === "faq" ? "FAQ" : kind[0].toUpperCase() + kind.slice(1)}</span>
          <span className="actions">
            <button className="button small" type="button" disabled={index === 0} onClick={() => moveWidget(index, -1)}>Move up</button>
            <button className="button small" type="button" disabled={index === value.order.length - 1} onClick={() => moveWidget(index, 1)}>Move down</button>
          </span>
        </li>)}
      </ol>
    </div>

    <fieldset className="widget-config-card stack">
      <legend>Guestbook</legend>
      <label className="check"><input type="checkbox" checked={value.guestbook.enabled}
        onChange={(event) => updateGuestbook({ enabled: event.target.checked })}/> Enable Guestbook</label>
      <label>Heading<input maxLength={80} value={value.guestbook.heading}
        onChange={(event) => updateGuestbook({ heading: event.target.value })}/></label>
      <label>Description<textarea rows={2} maxLength={240} value={value.guestbook.description}
        onChange={(event) => updateGuestbook({ description: event.target.value })}/></label>
      <label>Approved messages shown
        <select value={value.guestbook.maxEntries} onChange={(event) => updateGuestbook({ maxEntries: Number(event.target.value) as ProfileWidgets["guestbook"]["maxEntries"] })}>
          {[3,5,8,10].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <label className="check"><input type="checkbox" checked={value.guestbook.submissionsOpen}
        onChange={(event) => updateGuestbook({ submissionsOpen: event.target.checked })}/> Accept new visitor messages</label>
      <p className="muted">New entries are always held for your approval. Visitor names and messages are plain text; visitors cannot publish HTML or links.</p>
    </fieldset>

    <fieldset className="widget-config-card stack">
      <legend>Testimonials</legend>
      <label className="check"><input type="checkbox" checked={value.testimonials.enabled}
        onChange={(event) => updateTestimonials({ enabled: event.target.checked })}/> Enable Testimonials</label>
      <label>Heading<input maxLength={80} value={value.testimonials.heading}
        onChange={(event) => updateTestimonials({ heading: event.target.value })}/></label>
      <p className="muted">Testimonials are creator-curated profile content. Only add feedback you have permission to publish.</p>
      {value.testimonials.items.map((item, index) => <div className="widget-item-editor stack" key={item.id}>
        <h3>Testimonial {index + 1}</h3>
        <label>Quote<textarea required={value.testimonials.enabled} rows={3} maxLength={500} value={item.quote}
          onChange={(event) => updateTestimonials({ items: value.testimonials.items.map((current) => current.id === item.id ? { ...current, quote: event.target.value } : current) })}/></label>
        <label>Author<input required={value.testimonials.enabled} maxLength={80} value={item.author}
          onChange={(event) => updateTestimonials({ items: value.testimonials.items.map((current) => current.id === item.id ? { ...current, author: event.target.value } : current) })}/></label>
        <label>Role or description<input maxLength={80} value={item.role}
          onChange={(event) => updateTestimonials({ items: value.testimonials.items.map((current) => current.id === item.id ? { ...current, role: event.target.value } : current) })}/></label>
        <button type="button" className="button small" onClick={() => updateTestimonials({ items: value.testimonials.items.filter((current) => current.id !== item.id) })}>Remove testimonial</button>
      </div>)}
      <button type="button" className="button small" disabled={value.testimonials.items.length >= 6}
        onClick={() => updateTestimonials({ items: [...value.testimonials.items, { id: newId(), quote: "", author: "", role: "" }] })}>Add testimonial</button>
    </fieldset>

    <fieldset className="widget-config-card stack">
      <legend>Poll</legend>
      <label className="check"><input type="checkbox" checked={value.poll.enabled}
        onChange={(event) => updatePoll({ enabled: event.target.checked })}/> Enable Poll</label>
      <label>Question<input required={value.poll.enabled} minLength={5} maxLength={180} value={value.poll.question}
        onChange={(event) => updatePoll({ question: event.target.value }, true)}/></label>
      <p className="muted">Changing the poll question or options starts a new poll so votes from an older version are never mixed with the new results.</p>
      {value.poll.options.map((option, index) => <div className="widget-option-editor" key={option.id}>
        <label>Option {index + 1}<input required={value.poll.enabled} maxLength={80} value={option.label}
          onChange={(event) => updatePoll({ options: value.poll.options.map((current) => current.id === option.id ? { ...current, label: event.target.value } : current) }, true)}/></label>
        <button type="button" className="button small" disabled={value.poll.options.length <= 2}
          onClick={() => updatePoll({ options: value.poll.options.filter((current) => current.id !== option.id) }, true)}>Remove</button>
      </div>)}
      <button type="button" className="button small" disabled={value.poll.options.length >= 6}
        onClick={() => updatePoll({ options: [...value.poll.options, { id: newId(), label: "" }] }, true)}>Add poll option</button>
      <label>Close poll at (optional)<input type="datetime-local" value={value.poll.closesAt ? value.poll.closesAt.slice(0,16) : ""}
        onChange={(event) => updatePoll({ closesAt: event.target.value ? new Date(event.target.value).toISOString() : null })}/></label>
      <label className="check"><input type="checkbox" checked={value.poll.open}
        onChange={(event) => updatePoll({ open: event.target.checked })}/> Poll is open for voting</label>
      <label className="check"><input type="checkbox" checked={value.poll.showResultsBeforeVote}
        onChange={(event) => updatePoll({ showResultsBeforeVote: event.target.checked })}/> Show results before visitors vote</label>
      <p className="muted">Polls are for informal engagement, not secure ballots. Snoozer limits each browser token to one vote per poll, but cannot verify unique people.</p>
    </fieldset>

    <fieldset className="widget-config-card stack">
      <legend>FAQ</legend>
      <label className="check"><input type="checkbox" checked={value.faq.enabled}
        onChange={(event) => updateFaq({ enabled: event.target.checked })}/> Enable FAQ</label>
      <label>Heading<input maxLength={80} value={value.faq.heading}
        onChange={(event) => updateFaq({ heading: event.target.value })}/></label>
      {value.faq.items.map((item, index) => <div className="widget-item-editor stack" key={item.id}>
        <h3>Question {index + 1}</h3>
        <label>Question<input required={value.faq.enabled} maxLength={120} value={item.question}
          onChange={(event) => updateFaq({ items: value.faq.items.map((current) => current.id === item.id ? { ...current, question: event.target.value } : current) })}/></label>
        <label>Answer<textarea required={value.faq.enabled} rows={3} maxLength={1000} value={item.answer}
          onChange={(event) => updateFaq({ items: value.faq.items.map((current) => current.id === item.id ? { ...current, answer: event.target.value } : current) })}/></label>
        <button type="button" className="button small" onClick={() => updateFaq({ items: value.faq.items.filter((current) => current.id !== item.id) })}>Remove question</button>
      </div>)}
      <button type="button" className="button small" disabled={value.faq.items.length >= 10}
        onClick={() => updateFaq({ items: [...value.faq.items, { id: newId(), question: "", answer: "" }] })}>Add FAQ question</button>
    </fieldset>
  </div>;
}
