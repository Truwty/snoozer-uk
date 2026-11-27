"use client";

import Link from "next/link";
import { useRef } from "react";
import { removeSavedAccount, switchAccount } from "@/app/auth/account-actions";
import { signOut } from "@/app/auth/actions";
import type { SavedAccount } from "@/lib/account-sessions";

export type AccountMenuProps = {
  accounts: SavedAccount[];
  activeSlot: string;
  current: { label: string; username?: string; avatar?: string; isOwner?: boolean } | null;
};

function Avatar({ name, src }: { name: string; src?: string }) {
  return <span className="account-avatar" aria-hidden="true">
    {src
      // Local, validated avatar route from the verified account's draft.
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={src} alt="" width={38} height={38} onError={(event) => { event.currentTarget.style.display = "none"; }} />
      : null}
    <span>{name.slice(0, 1).toUpperCase()}</span>
  </span>;
}

export function AccountMenu({ accounts, activeSlot, current }: AccountMenuProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const active = current?.label || "Dashboard";
  const showManager = () => {
    menu.current?.removeAttribute("open");
    dialog.current?.showModal();
  };
  return <>
    <details id="studio-account-menu" className="account-dropdown" ref={menu}>
      <summary className="account-trigger">
        <Avatar name={active} src={current?.avatar}/>
        <span className="account-trigger-identity">
          <strong>{current?.username ? "@" + current.username : active}</strong>
          <small>{current ? "YOUR ACCOUNT" : "Sign in"}</small>
        </span>
        <svg aria-hidden="true" className="account-chevron" width="16" height="16" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
      </summary>
      <div className="account-popover">
        {current ? <>
          <p className="account-popover-owner"><Avatar name={active} src={current.avatar}/><strong>{active}</strong>{current.isOwner && <span className="account-owner-mark">OWNER</span>}</p>
          <div className="account-popover-rule"/>
          <Link href="/studio/account">Account Settings</Link>
          {current.username ? <Link href={`/${current.username}`}>My Page</Link> : <Link href="/studio">My Page</Link>}
          <button type="button" onClick={showManager}>Switch Accounts</button>
          <form action={signOut}><button type="submit" className="account-danger">Logout</button></form>
        </> : <>
          <Link href="/sign-in">Sign in</Link>
          <Link href="/sign-up">Create account</Link>
          {accounts.length > 0 && <button type="button" onClick={showManager}>Switch Accounts</button>}
        </>}
      </div>
    </details>

    <dialog className="accounts-dialog" aria-labelledby="accounts-dialog-title" ref={dialog} onClick={(event) => {
      if (event.target === dialog.current) dialog.current?.close();
    }}>
      <div className="accounts-dialog-header">
        <div><h2 id="accounts-dialog-title">Manage Accounts</h2><p>Switch seamlessly between signed-in accounts.</p></div>
        <button type="button" className="accounts-close" aria-label="Close account manager" onClick={() => dialog.current?.close()}>×</button>
      </div>
      <div className="accounts-list">
        {accounts.map((item) => <div className="account-entry" key={item.slot}>
          <Avatar name={item.slot === activeSlot && current ? current.label : item.label}
            src={item.slot === activeSlot ? current?.avatar : undefined}/>
          <div className="account-entry-label">
            <strong>{item.slot === activeSlot && current ? current.label : item.label}</strong>
            <small>{item.slot === activeSlot && current ? "Active account" : item.email ?? "Saved account"}</small>
          </div>
          <details className="account-row-actions">
            <summary aria-label={`Manage ${item.label}`}>···</summary>
            <div className="account-row-popup">
              {item.slot !== activeSlot && <form action={switchAccount}>
                <input type="hidden" name="slot" value={item.slot}/>
                <button type="submit">Switch to account</button>
              </form>}
              <form action={removeSavedAccount}>
                <input type="hidden" name="slot" value={item.slot}/>
                <button type="submit" className="account-danger">Sign out this account</button>
              </form>
            </div>
          </details>
        </div>)}
      </div>
      {accounts.length < 4
        ? <Link className="accounts-add" href="/sign-in?add=1">
          <span aria-hidden="true">⊕</span> Add an account
        </Link>
        : <p className="muted">Maximum of four accounts on this browser.</p>}
      <p className="accounts-private">Accounts stay signed in on this browser until you sign out or their sessions are revoked. Never use this feature on a shared device.</p>
    </dialog>
  </>;
}
