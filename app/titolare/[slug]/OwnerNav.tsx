'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';

const items=[
 ['', 'Dashboard','⌂'],['agenda','Agenda','▣'],['prenota','Prenota','＋'],['clienti','Clienti','♙'],['impostazioni','Impostazioni','⚙']
] as const;
export default function OwnerNav({slug,nome}:{slug:string;nome:string}){
 const pathname=usePathname();const base=`/titolare/${slug}`;
 return <><aside className="owner-sidebar"><div className="owner-brand"><b>Prenow</b><span>{nome}</span></div><nav>{items.map(([part,label,icon])=>{const href=part?`${base}/${part}`:base;const on=part?pathname.startsWith(href):pathname===href;return <Link className={on?'active':''} href={href} key={label}><i>{icon}</i><span>{label}</span></Link>})}</nav><Link className="owner-public-link" href={`/cliente/${slug}`}>Apri app cliente ↗</Link></aside><nav className="owner-mobile-nav">{items.map(([part,label,icon])=>{const href=part?`${base}/${part}`:base;const on=part?pathname.startsWith(href):pathname===href;return <Link className={on?'active':''} href={href} key={label}><i>{icon}</i><span>{label}</span></Link>})}</nav></>;
}
