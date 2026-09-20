'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {createBrowserSupabaseClient} from '@/lib/supabase/client';
import {ExternalLinkIcon,LogoutIcon,SettingsIcon,UserIcon} from './OwnerIcons';
import type {OwnerRole} from '@/lib/owner-auth';

export default function OwnerUserMenu({slug,email,role}:{slug:string;email:string;role:OwnerRole}){
 const [open,setOpen]=useState(false),ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{const close=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false)};document.addEventListener('mousedown',close);return()=>document.removeEventListener('mousedown',close)},[]);
 const label=role==='tenant_admin'?'Titolare':role==='staff'?'Gestione':'Operatore';
 const initials=(email.split('@')[0]||'U').slice(0,2).toUpperCase();
 async function logout(){const db=createBrowserSupabaseClient();await db.auth.signOut();window.location.assign(`/titolare/${encodeURIComponent(slug)}/login`)}
 return <div className="owner-user-menu" ref={ref}>
  <button className="owner-user-trigger" type="button" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-haspopup="menu">
   <span className="owner-user-avatar">{initials}</span>
   <span className="owner-user-copy"><b>{label}</b><small>{email}</small></span>
   <span className="owner-user-chevron">⌄</span>
  </button>
  {open&&<div className="owner-user-dropdown" role="menu">
   <Link href={`/titolare/${encodeURIComponent(slug)}/impostazioni`} onClick={()=>setOpen(false)}><SettingsIcon/><span>Impostazioni</span></Link>
   <Link href={`/cliente/${encodeURIComponent(slug)}`} onClick={()=>setOpen(false)}><ExternalLinkIcon/><span>Apri app cliente</span></Link>
   <button type="button" onClick={logout}><LogoutIcon/><span>Esci</span></button>
  </div>}
 </div>
}
