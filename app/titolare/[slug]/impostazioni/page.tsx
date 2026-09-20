import {requireTenantManager} from '@/lib/owner-auth';
import {createServerClient} from '@/lib/supabase/server';
import SettingsManager from './SettingsManager';

export const dynamic='force-dynamic';
type Tab='attivita'|'aspetto'|'servizi'|'orari'|'operatori';
type Member={operator_id:string;nome:string;cognome:string|null;email:string|null;ruolo:'staff'|'operator';attivo:boolean;absence_count:number};

export default async function Settings({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{tab?:string;saved?:string;error?:string}>}){
 const {slug}=await params,q=await searchParams,ctx=await requireTenantManager(slug),db=await createServerClient();
 const selected=(['attivita','aspetto','servizi','orari','operatori'].includes(q.tab||'')?q.tab:'attivita') as Tab;
 const [tenant,settings,branding,services,hours,members,bookingFeature,recurrenceFeature]=await Promise.all([
  db.from('tenants').select('nome').eq('id',ctx.tenant_id).single(),
  db.from('tenant_settings').select('*').eq('tenant_id',ctx.tenant_id).maybeSingle(),
  db.from('tenant_branding').select('*').eq('tenant_id',ctx.tenant_id).maybeSingle(),
  db.from('services').select('*').eq('tenant_id',ctx.tenant_id).order('ordine').order('created_at'),
  db.from('business_hours').select('*').eq('tenant_id',ctx.tenant_id).is('operator_id',null).order('weekday'),
  db.rpc('prenow_owner_staff',{p_slug:slug}),
  db.from('tenant_features').select('enabled').eq('tenant_id',ctx.tenant_id).eq('feature_key','customer_booking').maybeSingle(),
  db.from('tenant_features').select('enabled').eq('tenant_id',ctx.tenant_id).eq('feature_key','customer_recurrence').maybeSingle()
 ]);
 return <><div className="owner-heading"><div><p>Configurazione</p><h1>Impostazioni</h1><span>Gestisci attività, aspetto, servizi, orari e operatori.</span></div></div>
 {q.saved&&<p className="owner-alert success">Modifiche salvate.</p>}{q.error&&<p className="owner-alert error">Non è stato possibile salvare. Controlla i dati.</p>}
 <SettingsManager slug={slug} initialTab={selected} tenant={tenant.data||{}} settings={settings.data||{}} branding={branding.data||{}} services={services.data||[]} hours={hours.data||[]} operators={(members.data||[]) as Member[]} bookingEnabled={bookingFeature.data?.enabled??true} recurrenceEnabled={recurrenceFeature.data?.enabled??false}/></>;
}
