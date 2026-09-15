'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';

const items=[
 {key:'home',label:'Home',suffix:'',icon:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h5v-5h3v5h5v-9.5"/></svg>},
 {key:'book',label:'Prenota',suffix:'/prenota',icon:<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></svg>},
 {key:'appointments',label:'Appuntamenti',suffix:'/appuntamenti',icon:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>},
 {key:'profile',label:'Profilo',suffix:'/profilo',icon:<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4.5 21c.7-4.2 3.2-6.5 7.5-6.5s6.8 2.3 7.5 6.5"/></svg>}
];
export default function CustomerNav({slug}:{slug:string}){
 const pathname=usePathname();
 if(pathname.includes('/login')||pathname.includes('/prenota'))return null;
 return <nav className="customer-nav" aria-label="Navigazione principale">{items.map(item=>{
  const href=`/cliente/${encodeURIComponent(slug)}${item.suffix}`;
  const active=item.suffix?pathname===href:pathname===`/cliente/${slug}`;
  return <Link key={item.key} href={href} className={active?'active':''}>{item.icon}<span>{item.label}</span></Link>;
 })}</nav>;
}
