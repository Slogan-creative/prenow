import { requirePlatformAdmin } from '@/lib/auth';
import AdminSidebar from './_components/AdminSidebar';
import AdminTopbar from './_components/AdminTopbar';

// Ogni pagina sotto /admin passa da qui prima di renderizzare: se chi
// visita non è un Super Admin autenticato, requirePlatformAdmin() reindirizza
// altrove (vedi lib/auth.ts) e il resto di questo layout non viene eseguito.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { nome } = await requirePlatformAdmin();

  return (
    <div className="shell">
      <AdminSidebar />
      <div className="main">
        <AdminTopbar nomeAdmin={nome} />
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
