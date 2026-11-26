"use client";

import { useState } from "react";

type Badge = { id: string; slug: string; name: string; description: string; rarity: string; source: string; is_public: boolean };

export function StudioBadgeOrder({ badges }: { badges: Badge[] }) {
  const [order, setOrder] = useState(() => badges.filter((badge) => badge.is_public).map((badge) => badge.slug));
  const toggle = (slug: string, checked: boolean) => setOrder((items) => checked ? [...items, slug] : items.filter((item) => item !== slug));
  const move = (index: number, offset: number) => setOrder((items) => {
    const next = index + offset;
    if (next < 0 || next >= items.length) return items;
    const result = [...items]; [result[index], result[next]] = [result[next], result[index]]; return result;
  });
  return <>
    <input type="hidden" name="badgeOrder" value={JSON.stringify(order)}/>
    <div className="studio-official-badge-grid" aria-label="Choose and order public badges">
      {badges.map((badge) => {
        const index = order.indexOf(badge.slug);
        return <label className={`studio-official-badge rarity-${badge.rarity}${index >= 0 ? " is-public" : ""}`} key={badge.id}>
          <input type="checkbox" checked={index >= 0} onChange={(event) => toggle(badge.slug, event.target.checked)}/>
          <span className="studio-badge-card-copy"><strong>{badge.name}</strong><p>{badge.description}</p>
            <small>{badge.rarity.toUpperCase()} · {badge.source === "owner" ? "Owner awarded" : "Automatically earned"} · {index >= 0 ? `Public · position ${index + 1}` : "Hidden"}</small>
          </span>
          {index >= 0 && <span className="studio-badge-order-controls">
            <button type="button" aria-label={`Move ${badge.name} up`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
            <button type="button" aria-label={`Move ${badge.name} down`} disabled={index === order.length - 1} onClick={() => move(index, 1)}>↓</button>
          </span>}
        </label>;
      })}
    </div>
  </>;
}
