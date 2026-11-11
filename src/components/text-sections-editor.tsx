"use client";

import { useRef, useState } from "react";
import { sectionKinds, sectionLabels, textSectionLimits, type TextSection } from "@/lib/profile";

export function TextSectionsEditor({ sections, onChange }: {
  sections: TextSection[];
  onChange: (sections: TextSection[]) => void;
}) {
  const headings = useRef<Record<number, HTMLInputElement | null>>({});
  const add = useRef<HTMLButtonElement>(null);
  const [announcement, setAnnouncement] = useState("");

  function focusHeading(index: number) {
    window.requestAnimationFrame(() => (headings.current[index] ?? add.current)?.focus());
  }

  function move(from: number, to: number) {
    const reordered = [...sections];
    [reordered[from], reordered[to]] = [reordered[to], reordered[from]];
    onChange(reordered);
    setAnnouncement(`Moved text section to position ${to + 1} of ${reordered.length}.`);
    focusHeading(to);
  }

  function change(index: number, update: Partial<TextSection>) {
    onChange(sections.map((section, position) => position === index ? { ...section, ...update } : section));
  }

  return <fieldset className="stack">
    <legend className="section-title">Text sections <small>{sections.length}/{textSectionLimits.count}</small></legend>
    <p className="muted">Add text, highlight an update with a callout, share a quote, or count down to an event. Sections appear above your links.</p>
    <p className="sr-only" aria-live="polite">{announcement}</p>
    {sections.map((section, index) => <div key={index} className="link-editor stack">
      <label>Section {index + 1} type
        <select value={section.kind ?? "text"} onChange={(event) => {
          const kind = sectionKinds.find((candidate) => candidate === event.target.value);
          if (kind) change(index, {
            kind: kind === "text" ? undefined : kind,
            target: kind === "countdown" ? section.target ?? "" : undefined,
          });
        }}>
          {sectionKinds.map((kind) => <option value={kind} key={kind}>{sectionLabels[kind]}</option>)}
        </select>
      </label>
      <label>Section {index + 1} {section.kind === "quote" ? "attribution" : "heading"}
        <input required maxLength={textSectionLimits.heading} value={section.heading}
          ref={(input) => { headings.current[index] = input; }}
          onChange={(event) => change(index, { heading: event.target.value })} />
      </label>
      {section.kind === "countdown" && <label>Section {index + 1} target time (UTC)
        <input type="datetime-local" step={60} required value={section.target ?? ""}
          onChange={(event) => change(index, { target: event.target.value })} />
      </label>}
      <label>Section {index + 1} text
        <textarea required maxLength={textSectionLimits.body} rows={4} value={section.body}
          onChange={(event) => change(index, { body: event.target.value })} />
      </label>
      <label className="check"><input type="checkbox" checked={section.hidden ?? false}
        onChange={(event) => change(index, { hidden: event.target.checked || undefined })} />
        Hide section {index + 1} from public profile
      </label>
      <div className="actions">
        <button type="button" className="button small" disabled={index === 0} aria-label={`Move up (section ${index + 1})`}
          onClick={() => move(index, index - 1)}>Move up</button>
        <button type="button" className="button small" disabled={index === sections.length - 1} aria-label={`Move down (section ${index + 1})`}
          onClick={() => move(index, index + 1)}>Move down</button>
        <button type="button" className="button small" aria-label={`Remove section ${index + 1}`} onClick={() => {
          onChange(sections.filter((_, position) => position !== index));
          setAnnouncement(`Removed text section ${index + 1}.`);
          focusHeading(Math.min(index, sections.length - 2));
        }}>Remove</button>
      </div>
    </div>)}
    <button type="button" className="button" ref={add} disabled={sections.length >= textSectionLimits.count} onClick={() => {
      onChange([...sections, { heading: "", body: "" }]);
      focusHeading(sections.length);
    }}>Add text section</button>
  </fieldset>;
}
