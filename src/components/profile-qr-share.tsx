"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";

function downloadBlob(blob:Blob,fileName:string){
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;
  link.download=fileName;
  link.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function ProfileQrShare({profilePath}:{profilePath:string}){
  const [open,setOpen]=useState(false);
  const [qrOpen,setQrOpen]=useState(false);
  const [value,setValue]=useState("");
  const [message,setMessage]=useState("");

  useEffect(()=>{
    if(!open)return;
    const previous=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){
        if(qrOpen)setQrOpen(false);
        else setOpen(false);
      }
    };
    document.addEventListener("keydown",onKeyDown);
    return ()=>{
      document.body.style.overflow=previous;
      document.removeEventListener("keydown",onKeyDown);
    };
  },[open,qrOpen]);

  function openShare(){
    setValue(new URL(profilePath,window.location.origin).href);
    setMessage("");
    setQrOpen(false);
    setOpen(true);
  }

  async function copy(){
    try{
      await navigator.clipboard.writeText(value);
      setMessage("Profile URL copied.");
    }catch{
      setMessage("Couldn’t copy the URL. Select and copy the address below.");
    }
  }

  function downloadSvg(){
    const source=document.getElementById("snoozer-profile-qr-svg");
    if(!(source instanceof SVGSVGElement)){setMessage("The QR code is not ready yet.");return;}
    const svg=source.cloneNode(true) as SVGSVGElement;
    svg.setAttribute("xmlns","http://www.w3.org/2000/svg");
    svg.setAttribute("width","640");
    svg.setAttribute("height","640");
    const markup=new XMLSerializer().serializeToString(svg);
    downloadBlob(new Blob([markup],{type:"image/svg+xml;charset=utf-8"}),"snoozer-profile-qr.svg");
    setMessage("SVG download started.");
  }

  function downloadPng(){
    const canvas=document.getElementById("snoozer-profile-qr-png");
    if(!(canvas instanceof HTMLCanvasElement)){setMessage("The QR code is not ready yet.");return;}
    canvas.toBlob((blob)=>{
      if(!blob){setMessage("PNG export failed. Try SVG instead.");return;}
      downloadBlob(blob,"snoozer-profile-qr.png");
      setMessage("PNG download started.");
    },"image/png");
  }

  return <>
    <button type="button" className="studio-sidebar-share-button" onClick={openShare}>
      <span aria-hidden="true">⌯</span><span className="studio-nav-copy">Share Your Profile</span>
    </button>
    {open&&<div className="studio-profile-qr-overlay" onMouseDown={(event)=>{if(event.target===event.currentTarget)setOpen(false);}}>
      <section className="studio-profile-qr-dialog studio-share-dialog" role="dialog" aria-modal="true" aria-labelledby="studio-profile-share-title">
        <button type="button" className="studio-profile-qr-close" aria-label="Close share profile" onClick={()=>setOpen(false)}>×</button>
        <p className="eyebrow">SNOOZER / SHARE</p>
        <h2 id="studio-profile-share-title">Share Your Profile</h2>
        <p className="muted">Get more profile views by sharing your Snoozer link wherever people can find you.</p>

        <div className="studio-share-actions">
          <button type="button" className="studio-share-action" onClick={()=>{setMessage("");setQrOpen(true);}}>
            <span className="studio-share-action-icon" aria-hidden="true">▦</span>
            <span><strong>Snoozer QR Code</strong><small>Let people scan and open your profile</small></span>
            <span aria-hidden="true">↗</span>
          </button>
          <Link className="studio-share-action" href="/help?q=views" onClick={()=>setOpen(false)}>
            <span className="studio-share-action-icon" aria-hidden="true">◉</span>
            <span><strong>Get more profile views</strong><small>Guides for sharing and growing your profile</small></span>
            <span aria-hidden="true">↗</span>
          </Link>
          <a className="studio-share-action" href={profilePath} target="_blank" rel="noreferrer">
            <span className="studio-share-action-icon" aria-hidden="true">↗</span>
            <span><strong>Open My Page</strong><small>View your published Snoozer profile</small></span>
            <span aria-hidden="true">↗</span>
          </a>
        </div>

        <div className="studio-share-url-row">
          <span aria-hidden="true">☾</span>
          <code>{value}</code>
          <button type="button" className="button small" onClick={()=>void copy()}>Copy URL</button>
        </div>

        <div className="studio-share-support">
          <p className="eyebrow">HAVE A QUESTION OR NEED SUPPORT?</p>
          <Link className="studio-share-support-link" href="/help" onClick={()=>setOpen(false)}>
            <span aria-hidden="true">?</span> Help Centre
          </Link>
          <a className="studio-share-support-link" href="mailto:snoozersupport@snoozer.uk">
            <span aria-hidden="true">✉</span> Support Email
          </a>
        </div>
        {message&&<p className="message" role="status">{message}</p>}
      </section>

      {qrOpen&&<div className="studio-profile-qr-overlay studio-profile-qr-overlay--nested"
        onMouseDown={(event)=>{if(event.target===event.currentTarget)setQrOpen(false);}}>
        <section className="studio-profile-qr-dialog studio-profile-qr-dialog--nested" role="dialog" aria-modal="true" aria-labelledby="studio-profile-qr-title">
          <button type="button" className="studio-profile-qr-close" aria-label="Close QR code" onClick={()=>setQrOpen(false)}>×</button>
          <p className="eyebrow">SNOOZER / SHARE</p>
          <h2 id="studio-profile-qr-title">Snoozer QR Code</h2>
          <p className="muted">Scan this code to open your public Snoozer profile.</p>
          <div className="studio-profile-qr-frame">
            <QRCodeSVG id="snoozer-profile-qr-svg" value={value} size={264} level="H" includeMargin
              bgColor="#ffffff" fgColor="#111514" title="QR code for your Snoozer profile"/>
          </div>
          <div className="studio-profile-qr-actions">
            <button type="button" className="button primary" onClick={downloadPng}>Download PNG</button>
            <button type="button" className="button" onClick={downloadSvg}>Download SVG</button>
            <button type="button" className="button" onClick={()=>void copy()}>Copy link</button>
          </div>
          {message&&<p className="message" role="status">{message}</p>}
          <QRCodeCanvas id="snoozer-profile-qr-png" value={value} size={640} level="H" includeMargin
            bgColor="#ffffff" fgColor="#111514" style={{position:"absolute",width:1,height:1,left:-10000,top:-10000}}/>
        </section>
      </div>}
    </div>}
  </>;
}
