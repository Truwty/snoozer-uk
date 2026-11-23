"use client";

import type { ProfileBlock } from "@/lib/profile-blocks";

type Props = {
  blocks: ProfileBlock[];
  onChange: (blocks: ProfileBlock[]) => void;
};

export function ProfileBlocksEditor({ blocks, onChange }: Props) {
  function update(block: ProfileBlock, patch: Record<string, unknown>) {
    onChange(blocks.map((item) => item.id === block.id ? { ...item, ...patch } as ProfileBlock : item));
  }

  function remove(block: ProfileBlock) {
    onChange(blocks.filter((item) => item.id !== block.id));
  }

  return <section className="studio-profile-blocks stack" aria-labelledby="studio-profile-blocks-title">
    <header className="studio-blocks-heading">
      <div>
        <p className="eyebrow">PAGE CONTENT</p>
        <h2 id="studio-profile-blocks-title">Custom blocks</h2>
        <p className="muted">Edit the content here. Drag blocks in the live preview to change their position on your page.</p>
      </div>
      <span className="studio-block-count">{blocks.length} / 32</span>
    </header>
    {blocks.length === 0 ? <div className="studio-blocks-empty">
      <strong>Your page is ready for more detail</strong>
      <p className="muted">Add a heading, project, skills list, callout or other block from the Page Builder library.</p>
    </div> : <div className="studio-blocks-list">
      {blocks.map((block, index) => <article className={"studio-block-editor" + (block.hidden ? " is-hidden" : "")} key={block.id}>
        <header className="studio-block-editor-heading">
          <div>
            <span className="studio-block-number">BLOCK {String(index + 1).padStart(2, "0")}</span>
            <strong>{block.type[0].toUpperCase() + block.type.slice(1)}</strong>
          </div>
          <div className="studio-block-toggles">
            <label className="check">
              <input type="checkbox" checked={!block.hidden}
                onChange={(event) => update(block, { hidden: !event.target.checked })}/>
              Visible
            </label>
            <label className="check">
              <input type="checkbox" checked={block.locked}
                onChange={(event) => update(block, { locked: event.target.checked })}/>
              Locked
            </label>
            <button type="button" className="button small danger" disabled={block.locked}
              onClick={() => remove(block)} aria-label={"Remove block " + (index + 1)}>Remove</button>
          </div>
        </header>
        <div className="studio-block-layout-controls">
          <label>Width
            <select value={block.width} onChange={(event) => update(block, { width: event.target.value })}>
              <option value="full">Full</option><option value="half">Half</option><option value="third">Third</option>
            </select>
          </label>
          <label>Alignment
            <select value={block.align} onChange={(event) => update(block, { align: event.target.value })}>
              <option value="start">Left</option><option value="center">Centre</option><option value="end">Right</option>
            </select>
          </label>
          <label>Style
            <select value={block.variant} onChange={(event) => update(block, { variant: event.target.value })}>
              <option value="plain">Plain</option><option value="surface">Surface</option>
              <option value="outline">Outline</option><option value="accent">Accent</option>
            </select>
          </label>
        </div>
        <fieldset className="studio-block-fields stack" disabled={block.locked}>
          {block.type === "heading" && <>
            <label>Heading text<input maxLength={160} value={block.text} onChange={(event) => update(block, { text: event.target.value })}/></label>
            <label>Heading size<select value={block.level} onChange={(event) => update(block, { level: event.target.value })}>
              <option value="h2">Large</option><option value="h3">Small</option>
            </select></label>
          </>}
          {block.type === "about" && <>
            <label>Title<input maxLength={80} value={block.heading} onChange={(event) => update(block, { heading: event.target.value })}/></label>
            <label>About text<textarea maxLength={2000} rows={4} value={block.body} onChange={(event) => update(block, { body: event.target.value })}/></label>
          </>}
          {block.type === "callout" && <>
            <label>Title<input maxLength={80} value={block.heading} onChange={(event) => update(block, { heading: event.target.value })}/></label>
            <label>Message<textarea maxLength={1200} rows={3} value={block.body} onChange={(event) => update(block, { body: event.target.value })}/></label>
            <label>Tone<select value={block.tone} onChange={(event) => update(block, { tone: event.target.value })}>
              <option value="neutral">Neutral</option><option value="accent">Accent</option><option value="info">Information</option>
              <option value="success">Success</option><option value="warning">Warning</option>
            </select></label>
          </>}
          {block.type === "quote" && <>
            <label>Quote<textarea maxLength={1000} rows={3} value={block.quote} onChange={(event) => update(block, { quote: event.target.value })}/></label>
            <label>Attribution<input maxLength={100} value={block.attribution} onChange={(event) => update(block, { attribution: event.target.value })}/></label>
          </>}
          {block.type === "project" && <>
            <label>Project title<input maxLength={100} value={block.title} onChange={(event) => update(block, { title: event.target.value })}/></label>
            <label>Description<textarea maxLength={600} rows={3} value={block.description} onChange={(event) => update(block, { description: event.target.value })}/></label>
            <label>Project URL<input type="url" maxLength={2048} value={block.url} onChange={(event) => update(block, { url: event.target.value })}/></label>
            <label>Button label<input maxLength={40} value={block.buttonLabel} onChange={(event) => update(block, { buttonLabel: event.target.value })}/></label>
          </>}
          {block.type === "skills" && <>
            <label>Title<input maxLength={80} value={block.heading} onChange={(event) => update(block, { heading: event.target.value })}/></label>
            <label>Skills <span className="muted">One item per line, up to 20</span>
              <textarea rows={5} maxLength={1300} value={block.items.join("\n")}
                onChange={(event) => update(block, { items: event.target.value.split("\n").slice(0,20).map((item) => item.slice(0,60)) })}/>
            </label>
          </>}
          {block.type === "cta" && <>
            <label>Title<input maxLength={100} value={block.heading} onChange={(event) => update(block, { heading: event.target.value })}/></label>
            <label>Message<textarea maxLength={600} rows={3} value={block.body} onChange={(event) => update(block, { body: event.target.value })}/></label>
            <label>Button label<input maxLength={40} value={block.label} onChange={(event) => update(block, { label: event.target.value })}/></label>
            <label>Destination URL<input type="url" maxLength={2048} value={block.url} onChange={(event) => update(block, { url: event.target.value })}/></label>
          </>}
          {block.type === "divider" && <label>Divider style<select value={block.style} onChange={(event) => update(block, { style: event.target.value })}>
            <option value="line">Line</option><option value="space">Spacing</option><option value="dotted">Dotted</option>
          </select></label>}
          {block.type === "countdown" && <>
            <label>Title<input maxLength={80} value={block.heading} onChange={(event) => update(block, { heading: event.target.value })}/></label>
            <label>Target date and time<input type="datetime-local"
              value={(() => { const date = new Date(block.target); return Number.isNaN(date.valueOf()) ? "" : new Date(date.valueOf() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16); })()}
              onChange={(event) => { if (event.target.value) update(block, { target: new Date(event.target.value).toISOString() }); }}/></label>
          </>}
          {block.type === "stats" && <>
            <label>Title<input maxLength={80} value={block.heading} onChange={(event) => update(block, { heading: event.target.value })}/></label>
            <div className="studio-stats-editor">
              {block.items.map((item, itemIndex) => <div className="studio-stat-editor-row" key={itemIndex}>
                <label>Label<input maxLength={40} value={item.label} onChange={(event) => update(block, { items: block.items.map((entry, current) => current === itemIndex ? { ...entry, label: event.target.value } : entry) })}/></label>
                <label>Value<input maxLength={40} value={item.value} onChange={(event) => update(block, { items: block.items.map((entry, current) => current === itemIndex ? { ...entry, value: event.target.value } : entry) })}/></label>
                <button type="button" className="button small" disabled={block.items.length <= 1}
                  onClick={() => update(block, { items: block.items.filter((_, current) => current !== itemIndex) })}
                  aria-label={"Remove statistic " + (itemIndex + 1)}>−</button>
              </div>)}
              <button type="button" className="button small" disabled={block.items.length >= 6}
                onClick={() => update(block, { items: [...block.items, { label: "New stat", value: "0" }] })}>Add statistic</button>
            </div>
          </>}
        </fieldset>
      </article>)}
    </div>}
    <p className="muted studio-blocks-note">Hidden blocks stay in your draft and publication history. Locked blocks cannot be edited or removed until unlocked.</p>
  </section>;
}
