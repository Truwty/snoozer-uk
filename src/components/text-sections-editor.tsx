"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { sectionKinds, sectionLabels, textSectionLimits, type TextSection } from "@/lib/profile";

type SectionDrag = {
  pointer: number;
  from: number;
  source: TextSection;
  startY: number;
  x: number;
  y: number;
  active: boolean;
  frame: number;
};

export function TextSectionsEditor({ sections, onChange }: {
  sections: TextSection[];
  onChange: (sections: TextSection[]) => void;
}) {
  const headings = useRef<Record<number, HTMLInputElement | null>>({});
  const add = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLFieldSetElement>(null);
  const drag = useRef<SectionDrag | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  useEffect(() => () => {
    if (drag.current) window.cancelAnimationFrame(drag.current.frame);
  }, []);
  const [announcement, setAnnouncement] = useState("");

  function focusHeading(index: number) {
    window.requestAnimationFrame(() => (headings.current[index] ?? add.current)?.focus());
  }

  function move(from: number, to: number) {
    if (from === to || !sections[from] || !sections[to]) return;
    const reordered = [...sections];
    reordered.splice(to, 0, ...reordered.splice(from, 1));
    onChange(reordered);
    setAnnouncement("Moved section to position " + (to + 1) + " of " + reordered.length + ".");
    focusHeading(to);
  }

  function sectionAt(x: number, y: number) {
    const card = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-section-index]");
    return card && list.current?.contains(card) ? Number(card.dataset.sectionIndex) : null;
  }

  function beginDrag(event: PointerEvent<HTMLSpanElement>, index: number) {
    if (event.button !== 0 || !event.isPrimary || drag.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointer: event.pointerId, from: index, source: sections[index],
      startY: event.clientY, x: event.clientX, y: event.clientY, active: false, frame: 0,
    };
  }

  function updateDrop(active: SectionDrag) {
    setDropIndex(sectionAt(active.x, active.y));
    const edge = 56;
    const direction = active.y < edge ? -1 : active.y > window.innerHeight - edge ? 1 : 0;
    if (!direction || active.x < 0 || active.x >= window.innerWidth) return;
    const previousScroll = window.scrollY;
    window.scrollBy(0, direction * 12);
    if (window.scrollY !== previousScroll) active.frame = window.requestAnimationFrame(() => updateDrop(active));
  }

  function moveDrag(event: PointerEvent<HTMLSpanElement>) {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId) return;
    active.x = event.clientX;
    active.y = event.clientY;
    if (!active.active && Math.abs(active.y - active.startY) < 6) return;
    active.active = true;
    window.cancelAnimationFrame(active.frame);
    updateDrop(active);
  }

  function finishDrag(event: PointerEvent<HTMLSpanElement>, commit: boolean) {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId) return;
    drag.current = null;
    window.cancelAnimationFrame(active.frame);
    setDropIndex(null);
    if (!commit || !active.active || sections[active.from] !== active.source) return;
    const destination = sectionAt(event.clientX, event.clientY);
    if (destination !== null) move(active.from, destination);
  }

  function change(index: number, update: Partial<TextSection>) {
    onChange(sections.map((section, position) => position === index ? { ...section, ...update } : section));
  }

  return <fieldset className="stack" ref={list}>
    <legend className="section-title">Text sections <small>{sections.length}/{textSectionLimits.count}</small></legend>
    <p className="muted">Add text, highlight an update with a callout, share a quote, or count down to an event. Sections appear above your links. Drag a section or use its Move buttons.</p>
    <p className="sr-only" aria-live="polite">{announcement}</p>
    {sections.map((section, index) => <div key={index} className="link-editor stack" data-section-index={index}
      data-drop-target={dropIndex === index || undefined}>
      {sections.length > 1 && <span className="section-drag-handle" aria-hidden="true"
        onPointerDown={(event) => beginDrag(event, index)} onPointerMove={moveDrag}
        onPointerUp={(event) => finishDrag(event, true)}
        onPointerCancel={(event) => finishDrag(event, false)}
        onLostPointerCapture={(event) => finishDrag(event, false)}>Drag to move</span>}
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
