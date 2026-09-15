import {redirect} from 'next/navigation';import {requireTenantAdmin} from '@/lib/owner-auth';
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;await requireTenantAdmin(slug);redirect(`/staff/${encodeURIComponent(slug)}/prenotazione`)}
