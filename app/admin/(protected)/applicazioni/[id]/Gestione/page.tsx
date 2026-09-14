import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePlatformAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';
import { saveResource } from './actions';

export const dynamic = 'force-dynamic';

type Service = {
  id: string;
  nome: string;
  durata_min: number;
  prezzo_centesimi: number | null;
  attivo: boolean;
};

type Operator = {
  id: string;
  nome: string;
  attivo: boolean;
};

function ResourceFields({
  tenant,
  kind,
  id,
}: {
  tenant: string;
  kind: 'operator' | 'service';
  id?: string;
}) {
  return (
    <>
      <input type="hidden" name="tenant" value={tenant} />
      <input type="hidden" name="kind" value={kind} />
      {id && <input type="hidden" name="id" value={id} />}
    </>
  );
}

function ServiceForm({
  tenant,
  service,
}: {
  tenant: string;
  service?: Service;
}) {
  const prefix = service?.id ?? 'new-service';

  return (
    <form action={saveResource} className="settings-card">
      <ResourceFields
        tenant={tenant}
        kind="service"
        id={service?.id}
      />
      <h3>{service ? 'Modifica servizio' : 'Nuovo servizio'}</h3>

      <div className="field">
        <label htmlFor={`${prefix}-name`}>Nome</label>
        <input
          id={`${prefix}-name`}
          name="nome"
          defaultValue={service?.nome ?? ''}
          required
          maxLength={120}
        />
      </div>

      <div className="field">
        <label htmlFor={`${prefix}-duration`}>
          Durata in minuti
        </label>
        <input
          id={`${prefix}-duration`}
          name="durata"
          type="number"
          min={15}
          max={1440}
          step={15}
          defaultValue={service?.durata_min ?? 30}
          required
        />
      </div>

      <div className="field">
        <label htmlFor={`${prefix}-price`}>Prezzo in euro</label>
        <input
          id={`${prefix}-price`}
          name="prezzo"
          type="number"
          min={0}
          max={100000}
          step="0.01"
          defaultValue={
            service?.prezzo_centesimi == null
              ? ''
              : (service.prezzo_centesimi / 100).toFixed(2)
          }
        />
        <p className="field-hint">
          Lascia vuoto per non mostrare il prezzo.
        </p>
      </div>

      <label>
        <input
          type="checkbox"
          name="attivo"
          defaultChecked={service?.attivo ?? true}
        />{' '}
        Servizio attivo
      </label>

      <button className="btn btn-primary" type="submit">
        {service ? 'Salva servizio' : 'Crea servizio'}
      </button>
    </form>
  );
}

function OperatorForm({
  tenant,
  operator,
  services,
  assigned,
}: {
  tenant: string;
  operator?: Operator;
  services: Service[];
  assigned: Set<string>;
}) {
  const prefix = operator?.id ?? 'new-operator';

  return (
    <form action={saveResource} className="settings-card">
      <ResourceFields
        tenant={tenant}
        kind="operator"
        id={operator?.id}
      />
      <h3>{operator ? 'Modifica operatore' : 'Nuovo operatore'}</h3>

      <div className="field">
        <label htmlFor={`${prefix}-name`}>Nome visualizzato</label>
        <input
          id={`${prefix}-name`}
          name="nome"
          defaultValue={operator?.nome ?? ''}
          required
          maxLength={120}
        />
      </div>

      <label>
        <input
          type="checkbox"
          name="attivo"
          defaultChecked={operator?.attivo ?? true}
        />{' '}
        Operatore attivo
      </label>

      <fieldset style={{ margin: '16px 0' }}>
        <legend>Servizi eseguibili</legend>
        {services.length === 0 && (
          <p>Crea prima almeno un servizio.</p>
        )}

        {services.map((service) => (
          <label
            key={service.id}
            style={{ display: 'block', margin: '8px 0' }}
          >
            <input
              type="checkbox"
              name="services"
              value={service.id}
              defaultChecked={assigned.has(service.id)}
            />{' '}
            {service.nome}
            {!service.attivo && ' — disattivato'}
          </label>
        ))}
      </fieldset>

      <p className="field-hint">
        Senza servizi associati, l’operatore non sarà prenotabile.
      </p>

      <button className="btn btn-primary" type="submit">
        {operator ? 'Salva operatore' : 'Crea operatore'}
      </button>
    </form>
  );
}

export default async function Management({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  await requirePlatformAdmin();

  const { id } = await params;
  const message = await searchParams;

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    notFound();
  }

  const db = await createServerClient();

  const [tenant, serviceResult, operatorResult] =
    await Promise.all([
      db.from('tenants').select('nome').eq('id', id).maybeSingle(),
      db
        .from('services')
        .select('id,nome,durata_min,prezzo_centesimi,attivo')
        .eq('tenant_id', id)
        .order('ordine')
        .order('nome'),
      db
        .from('operators')
        .select('id,nome,attivo')
        .eq('tenant_id', id)
        .order('nome'),
    ]);

  if (tenant.error || serviceResult.error || operatorResult.error) {
    throw new Error('Impossibile leggere la gestione applicazione.');
  }

  if (!tenant.data) notFound();

  const services = (serviceResult.data ?? []) as Service[];
  const operators = (operatorResult.data ?? []) as Operator[];
  const assignments = new Map<string, Set<string>>();

  if (operators.length > 0) {
    const links = await db
      .from('operator_services')
      .select('operator_id,service_id')
      .in('operator_id', operators.map((operator) => operator.id));

    if (links.error) {
      throw new Error('Impossibile leggere le associazioni.');
    }

    for (const link of links.data ?? []) {
      const selected =
        assignments.get(link.operator_id) ?? new Set<string>();
      selected.add(link.service_id);
      assignments.set(link.operator_id, selected);
    }
  }

  return (
    <>
      <Link href={`/admin/applicazioni/${id}`}>
        ← Configurazione applicazione
      </Link>

      <h1 className="page-title">{tenant.data.nome}</h1>
      <p>Gestione operatori e servizi</p>

      {message.saved && (
        <p role="status" style={{ color: 'var(--success)' }}>
          Modifica salvata.
        </p>
      )}

      {message.error && (
        <p role="alert" style={{ color: 'var(--danger)' }}>
          {message.error}
        </p>
      )}

      <h2>Servizi</h2>
      <p>
        Dopo aver creato un servizio, associalo agli operatori.
        Disattivarlo non elimina le prenotazioni esistenti.
      </p>

      <div className="settings-grid">
        <ServiceForm tenant={id} />
        {services.map((service) => (
          <ServiceForm
            key={service.id}
            tenant={id}
            service={service}
          />
        ))}
      </div>

      <h2>Operatori</h2>
      <p>
        Seleziona i servizi eseguibili da ciascun operatore.
        Gli operatori disattivati restano nello storico.
      </p>

      <div className="settings-grid">
        <OperatorForm
          tenant={id}
          services={services}
          assigned={new Set<string>()}
        />
        {operators.map((operator) => (
          <OperatorForm
            key={operator.id}
            tenant={id}
            operator={operator}
            services={services}
            assigned={
              assignments.get(operator.id) ?? new Set<string>()
            }
          />
        ))}
      </div>
    </>
  );
}
