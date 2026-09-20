'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import type {OwnerRole} from '@/lib/owner-auth';
import {CalendarIcon,CalendarPlusIcon,HomeIcon,UsersIcon} from './OwnerIcons';

const items=[
 {part:'',label:'Home',Icon:HomeIcon,roles:['tenant_admin','staff','operator']},
 {part:'agenda',label:'Agenda',Icon:CalendarIcon,roles:['tenant_admin','staff','operator']},
 {part:'prenota',label:'Prenota',Icon:CalendarPlusIcon,roles:['tenant_admin','staff']},
 {part:'clienti',label:'Clienti',Icon:UsersIcon,roles:['tenant_admin','staff']}
] as const;

export default function OwnerNav({slug,nome,role}:{slug:string;nome:string;role:OwnerRole}){
 const pathname=usePathname(),base=`/titolare/${slug}`;
 const visible=items.filter(item=>(item.roles as readonly string[]).includes(role));
 const links=visible.map(({part,label,Icon})=>{
  const href=part?`${base}/${part}`:base;
  const on=part?pathname.startsWith(href):pathname===href;
  return <Link className={on?'active':''} href={href} key={label}><i className="owner-nav-icon"><Icon/></i><span>{label}</span></Link>
 });
 return <><aside className="owner-sidebar"><div className="owner-brand"><b>Prenow</b><span>{nome}</span></div><nav>{links}</nav></aside><nav className="owner-mobile-nav">{links}</nav></>;
}
