"use client";

import { useState } from "react";

export function StudioCustomBadgePreview() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="button small" type="button" onClick={() => setOpen(true)}>
        Preview Custom Badge
      </button>
      {open && (
        <div className="studio-badge-preview-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <section className="studio-badge-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="studio-badge-preview-title">
            <button className="studio-badge-preview-close" type="button" aria-label="Close badge preview" onClick={() => setOpen(false)}>×</button>
            <p className="eyebrow">CUSTOM BADGES</p>
            <h3 id="studio-badge-preview-title">Custom Badge Preview</h3>
            <p className="muted">Example of how a personal badge appears alongside your Snoozer profile identity.</p>
            <div className="studio-badge-preview-stage">
              <div className="studio-badge-preview-profile">
                <span className="studio-badge-preview-avatar">S</span>
                <span><strong>@yourprofile</strong><small>Snoozer profile</small></span>
              </div>
              <div className="studio-badge-preview-sample">
                <span aria-hidden="true">✦</span>
                <strong>Custom badge</strong>
                <small>Personal profile badge</small>
              </div>
            </div>
            <p className="muted">Custom badges are separate from verified Snoozer awards and never imply staff verification.</p>
            <button className="button primary" type="button" onClick={() => setOpen(false)}>Done</button>
          </section>
        </div>
      )}
    </>
  );
}
