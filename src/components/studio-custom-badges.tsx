"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { deleteCustomBadge, saveCustomBadgeVisibility, updateCustomBadge } from "@/app/studio/badges/actions";

type Badge = { id: string; title: string; description: string; icon: string; color: string; image_id: string | null; is_public: boolean; display_order: number };

export function StudioCustomBadges({ profile, badges }: { profile: string; badges: Badge[] }) {
  const [order, setOrder] = useState(() => badges.filter((badge) => badge.is_public).sort((a,b) => a.display_order-b.display_order).map((badge) => badge.id));
  const toggle = (id: string, checked: boolean) => setOrder((items) => checked ? [...items,id] : items.filter((item) => item !== id));
  const move = (index: number, offset: number) => setOrder((items) => {
    const target = index + offset; if (target < 0 || target >= items.length) return items;
    const result=[...items]; [result[index],result[target]]=[result[target],result[index]]; return result;
  });
  return <div className="studio-custom-badges-list">
    <form action={saveCustomBadgeVisibility} id="custom-badge-visibility">
      <input type="hidden" name="profile" value={profile}/><input type="hidden" name="customBadgeOrder" value={JSON.stringify(order)}/>
    </form>
    {badges.map((badge) => {
      const index=order.indexOf(badge.id);
      return <article className="studio-custom-badge-row" key={badge.id}>
        <label><input type="checkbox" checked={index>=0} onChange={(event)=>toggle(badge.id,event.target.checked)} form="custom-badge-visibility"/>
          <span className="studio-custom-badge-preview" style={{color:badge.color}} aria-hidden="true">
            {badge.image_id ? <img src={`/media/badges/${badge.id}`} alt="" width="34" height="34"/> : badge.icon}
          </span>
          <span><strong>{badge.title}</strong><small>{badge.description || "Custom Snoozer badge"}{index>=0?` · public position ${index+1}`:" · hidden"}</small></span>
        </label>
        <span><button type="button" disabled={index<=0} aria-label={`Move ${badge.title} up`} onClick={()=>move(index,-1)}>↑</button>
          <button type="button" disabled={index<0||index===order.length-1} aria-label={`Move ${badge.title} down`} onClick={()=>move(index,1)}>↓</button></span>
        <form action={updateCustomBadge} className="studio-custom-badge-edit">
          <input type="hidden" name="profile" value={profile}/><input type="hidden" name="id" value={badge.id}/>
          <label>Title<input name="title" defaultValue={badge.title} maxLength={40} required/></label>
          <label>Description<input name="description" defaultValue={badge.description} maxLength={160}/></label>
          <label>Symbol<input name="icon" defaultValue={badge.icon} maxLength={8} required/></label>
          <label>Colour<input name="color" type="color" defaultValue={badge.color}/></label>
          <button className="button small" type="submit">Save design</button>
        </form>
        <form action={deleteCustomBadge}><input type="hidden" name="profile" value={profile}/><input type="hidden" name="id" value={badge.id}/><button className="button small" type="submit">Delete</button></form>
      </article>;
    })}
    {badges.length>0&&<button className="button primary" type="submit" form="custom-badge-visibility">Save badge display</button>}
  </div>;
}
