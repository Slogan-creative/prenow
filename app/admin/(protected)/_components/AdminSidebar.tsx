'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Ogni voce corrisponde a una cartella sotto app/admin/. In questa prima fase
// solo "dashboard" e "applicazioni" hanno una pagina reale: le altre
// puntano a route non ancora create di proposito — vedi ARCHITETTURA.md
// per l'elenco di cosa manca e perché.
const NAV_ITEMS = [{ href: '/admin', label: 'Dashboard' }, { href: '/admin/applicazioni', label: 'Applicazioni' }];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <div className="sidebar">
      <div className="brand">
        <div className="brand-mark">P</div>
        <div>
          <div className="brand-name">Prenow</div>
          <div className="brand-sub">Dashboard piattaforma</div>
        </div>
      </div>
      <div className="nav-group">
        {NAV_ITEMS.map((item) => {
          const active = item.href === '/admin' ? pathname === '/admin' : pathname?.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={`nav-item${active ? ' active' : ''}`}>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
