'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import type {OwnerRole} from '@/lib/owner-auth';

const items=[
 {part:'',label:'Dashboard',icon:'⌂',roles:['tenant_admin','staff','operator']},
 {part:'agenda',label:'Agenda',icon:'▣',roles:['tenant_admin','staff','operator']},
 {part:'prenota',label:'Prenota',icon:'＋',roles:['tenant_admin','staff']},
 {part:'clienti',label:'Clienti',icon:'♙',roles:['tenant_admin','staff']},
 {part:'operatori',label:'Operatori',icon:'◎',roles:['tenant_admin']},
 {part:'impostazioni',label:'Impostazioni',icon:'⚙',roles:['tenant_admin']}
] as const;
export default function OwnerNav({slug,nome,role}:{slug:string;nome:string;role:OwnerRole}){
 const pathname=usePathname(),base=`/titolare/${slug}`;
 const visible=items.filter(item=>(item.roles as readonly string[]).includes(role));
 const links=visible.map(({part,label,icon})=>{const href=part?`${base}/${part}`:base;const on=part?pathname.startsWith(href):pathname===href;return <Link className={on?'active':''} href={href} key={label}><i>{icon}</i><span>{label}</span></Link>});
 return <><aside className="owner-sidebar"><div className="owner-brand"><b>Prenow</b><span>{nome}</span></div><nav>{links}</nav><Link className="owner-public-link" href={`/cliente/${slug}`}>Apri app cliente ↗</Link></aside><nav className="owner-mobile-nav">{links}</nav></>;
}
