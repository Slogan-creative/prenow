'use client';
import {useMemo,useState} from 'react';
import Link from 'next/link';
import {CalendarIcon,CalendarPlusIcon,HomeIcon,UsersIcon} from '../../../titolare/[slug]/OwnerIcons';

type Service={id:string;nome:string;durata_min:number;prezzo_centesimi:number|null};
type Operator={id:string;nome:string};
type Customer={id:string;nome:string;cognome:string|null;email:string|null;telefono:string|null};
type Slot={start_at:string};
type CustomService={name:string;duration:string;price:string};
type RecurrencePreview={error:boolean;total:number;available:number;conflicts:number;occurrences:{occurrence_no:number;date:string;start_at:string;available:boolean}[]};
const weekLabels=[{value:1,label:'Primo'},{value:2,label:'Secondo'},{value:3,label:'Terzo'},{value:4,label:'Quarto'},{value:-1,label:'Ultimo'}] as const;
const weekdayLabels=['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'];

export default function ManualBookingWizard({
 slug,today,services,operators,customers,initialCustomer,availability,previewRecurrence,book
}:{
 slug:string;today:string;services:Service[];operators:Operator[];customers:Customer[];initialCustomer?:string;
 availability:(service:string,operator:string,date:string,customName:string,customDuration:number)=>Promise<{slots:Slot[];error:boolean}>;
 previewRecurrence:(input:{service:string;operator:string;start:string;customName:string;customDuration:number;recurrenceType:string;endMode:string;count:number|null;endDate:string|null;weekOfMonth:number|null;weekday:number|null;interval:number})=>Promise<RecurrencePreview>;
 book:(form:FormData)=>Promise<void>;
}){
 const [step,setStep]=useState(initialCustomer?2:1);
 const [customerMode,setCustomerMode]=useState<'existing'|'new'>(initialCustomer?'existing':'existing');
 const [customerId,setCustomerId]=useState(initialCustomer||'');
 const [search,setSearch]=useState('');
 const [newCustomer,setNewCustomer]=useState({nome:'',cognome:'',email:'',telefono:''});
 const [serviceId,setServiceId]=useState('');
 const [custom,setCustom]=useState<CustomService>({name:'',duration:'30',price:''});
 const [operatorId,setOperatorId]=useState('');
 const [date,setDate]=useState('');
 const [month,setMonth]=useState(()=>new Date(today+'T12:00:00'));
 const [slots,setSlots]=useState<Slot[]>([]);
 const [selected,setSelected]=useState('');
 const [loading,setLoading]=useState(false);
 const [slotError,setSlotError]=useState(false);
 const [recurring,setRecurring]=useState(false);
 const [recurrenceType,setRecurrenceType]=useState('monthly_day');
 const [recurrenceInterval,setRecurrenceInterval]=useState('1');
 const [recurrenceEndMode,setRecurrenceEndMode]=useState<'count'|'date'>('count');
 const [recurrenceCount,setRecurrenceCount]=useState('6');
 const [recurrenceEndDate,setRecurrenceEndDate]=useState('');
 const [weekOfMonth,setWeekOfMonth]=useState(1);
 const [weekday,setWeekday]=useState(5);
 const [recurrencePreview,setRecurrencePreview]=useState<RecurrencePreview|null>(null);
 const [previewLoading,setPreviewLoading]=useState(false);
 const CUSTOM='__custom__';
 const selectedCustomer=customers.find(c=>c.id===customerId);
 const service=services.find(s=>s.id===serviceId);
 const operator=operators.find(o=>o.id===operatorId);
 const filtered=useMemo(()=>{const q=search.trim().toLowerCase();return customers.filter(c=>!q||`${c.nome} ${c.cognome||''} ${c.email||''} ${c.telefono||''}`.toLowerCase().includes(q)).slice(0,80)},[customers,search]);
 const totalSteps=6;
 const progress=<><p className="step-copy">Passaggio {step} di {totalSteps}</p><div className="progress-five manual-progress">{Array.from({length:totalSteps},(_,i)=><span key={i} className={i<step?'on':''}/>)}</div></>;
 const goBack=()=>{if(step>1){setStep(step-1);window.scrollTo(0,0)}else window.location.assign(`/titolare/${encodeURIComponent(slug)}`)};
 const header=<header className="claude-titlebar"><button type="button" className="round-back" aria-label="Torna indietro" onClick={goBack}>‹</button><h1>Nuova prenotazione</h1></header>;
 const days=useMemo(()=>{const y=month.getFullYear(),m=month.getMonth(),first=(new Date(y,m,1).getDay()+6)%7,total=new Date(y,m+1,0).getDate();return [...Array(first).fill(null),...Array.from({length:total},(_,i)=>i+1)]},[month]);
 const iso=(day:number)=>`${month.getFullYear()}-${String(month.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
 const next=(n:number)=>{setStep(n);window.scrollTo(0,0)};
 const canUseNew=!!newCustomer.nome.trim()&&(!!newCustomer.email.trim()||!!newCustomer.telefono.trim());
 const clearPreview=()=>setRecurrencePreview(null);
 async function chooseDate(value:string){
  setDate(value);setSelected('');setSlots([]);setSlotError(false);setLoading(true);clearPreview();next(5);
  const duration=serviceId===CUSTOM?Number(custom.duration):0;
  try{const r=await availability(serviceId,operatorId,value,custom.name,duration);setSlots(r.slots);setSlotError(r.error)}catch{setSlotError(true)}finally{setLoading(false)}
 }
 function chooseTime(start:string){
  setSelected(start);
  const d=new Date(date+'T12:00:00');
  const lastDay=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
  setWeekday(d.getDay());
  setWeekOfMonth(d.getDate()+7>lastDay?-1:Math.min(4,Math.ceil(d.getDate()/7)));
  if(!recurrenceEndDate){
   const end=new Date(d.getFullYear(),d.getMonth()+6,d.getDate());
   setRecurrenceEndDate(end.getFullYear()+'-'+String(end.getMonth()+1).padStart(2,'0')+'-'+String(end.getDate()).padStart(2,'0'));
  }
  clearPreview();next(6);
 }
 async function runPreview(){
  setPreviewLoading(true);clearPreview();
  try{
   const result=await previewRecurrence({
    service:serviceId,operator:operatorId,start:selected,customName:custom.name,customDuration:Number(custom.duration),
    recurrenceType,endMode:recurrenceEndMode,
    count:recurrenceEndMode==='count'?Number(recurrenceCount):null,
    endDate:recurrenceEndMode==='date'?recurrenceEndDate:null,
    weekOfMonth:recurrenceType==='monthly_nth_weekday'?weekOfMonth:null,
    weekday:recurrenceType.includes('monthly_nth_weekday')?weekday:null,
    interval:Number(recurrenceInterval)||1
   });
   setRecurrencePreview(result);
  }finally{setPreviewLoading(false)}
 }
 const serviceLabel=serviceId===CUSTOM?custom.name:service?.nome||'';
 const serviceMeta=serviceId===CUSTOM?`${custom.duration} min · €${custom.price||'0'}`:service?`${service.durata_min} min${service.prezzo_centesimi==null?'':` · €${Math.round(service.prezzo_centesimi/100)}`}`:'';
 const customerLabel=customerMode==='existing'?selectedCustomer?`${selectedCustomer.nome} ${selectedCustomer.cognome||''}`.trim():'':`${newCustomer.nome} ${newCustomer.cognome}`.trim();
 const conflictRows=recurrencePreview?.occurrences.filter(o=>!o.available)||[];
 const selectedDay=date?new Date(date+'T12:00:00').getDate():0;
 const interval=Math.max(1,Number(recurrenceInterval)||1);
 const recurrenceDescription=recurrenceType==='weekly'?'Ogni settimana':recurrenceType==='biweekly'?'Ogni 2 settimane':recurrenceType==='monthly_day'?'Ogni mese, giorno '+selectedDay:recurrenceType==='monthly_nth_weekday'?(weekLabels.find(x=>x.value===weekOfMonth)?.label||'')+' '+weekdayLabels[weekday]+' del mese':recurrenceType==='custom_weekly'?'Ogni '+interval+(interval===1?' settimana':' settimane')+', '+weekdayLabels[weekday].toLowerCase():recurrenceType==='custom_monthly_day'?'Ogni '+interval+(interval===1?' mese':' mesi')+', giorno '+selectedDay:'Ogni '+interval+(interval===1?' mese, ':' mesi, ')+(weekLabels.find(x=>x.value===weekOfMonth)?.label||'')+' '+weekdayLabels[weekday].toLowerCase();

 const bottomNav=<nav className="owner-mobile-nav booking-owner-mobile-nav">
  <Link href={`/titolare/${slug}`}><i className="owner-nav-icon"><HomeIcon/></i><span>Home</span></Link>
  <Link href={`/titolare/${slug}/agenda`}><i className="owner-nav-icon"><CalendarIcon/></i><span>Agenda</span></Link>
  <Link className="active" href={`/staff/${slug}/prenotazione`}><i className="owner-nav-icon"><CalendarPlusIcon/></i><span>Prenota</span></Link>
  <Link href={`/titolare/${slug}/clienti`}><i className="owner-nav-icon"><UsersIcon/></i><span>Clienti</span></Link>
 </nav>;
 return <main className="customer-ui owner-booking-ui"><div className="customer-app booking-flow">{header}<section className="wizard-body">{progress}
  {step===1&&<><h2>Per chi?</h2><p>Scegli un cliente esistente oppure creane uno nuovo.</p><div className="owner-booking-mode"><button type="button" className={customerMode==='existing'?'active':''} onClick={()=>setCustomerMode('existing')}>Cliente esistente</button><button type="button" className={customerMode==='new'?'active':''} onClick={()=>setCustomerMode('new')}>Nuovo cliente</button></div>
   {customerMode==='existing'?<><input className="owner-booking-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cerca per nome, email o telefono"/><div className="owner-customer-choice">{filtered.map(c=><button type="button" key={c.id} className={customerId===c.id?'selected':''} onClick={()=>{setCustomerId(c.id);next(2)}}><span className="op-avatar">{c.nome.charAt(0)}</span><span><strong>{c.nome} {c.cognome||''}</strong><small>{c.email||c.telefono||'Nessun contatto'}</small></span><b>›</b></button>)}</div></>:<div className="claude-card owner-new-customer"><label>Nome<input value={newCustomer.nome} onChange={e=>setNewCustomer({...newCustomer,nome:e.target.value})}/></label><label>Cognome<input value={newCustomer.cognome} onChange={e=>setNewCustomer({...newCustomer,cognome:e.target.value})}/></label><label>Email<input type="email" value={newCustomer.email} onChange={e=>setNewCustomer({...newCustomer,email:e.target.value})}/></label><label>Telefono<input type="tel" value={newCustomer.telefono} onChange={e=>setNewCustomer({...newCustomer,telefono:e.target.value})}/></label><button type="button" className="claude-primary" disabled={!canUseNew} onClick={()=>next(2)}>Continua</button></div>}
  </>}
  {step===2&&<><h2>Cosa deve fare?</h2><p>Scegli un servizio del catalogo oppure creane uno personalizzato per questo appuntamento.</p><div className="svc-full-card">{services.map(s=><button type="button" key={s.id} className="svc-full-row" onClick={()=>{setServiceId(s.id);next(3)}}><div><div className="svc-full-nome">{s.nome}</div><div className="svc-full-durata">{s.durata_min} min</div></div><div className="svc-full-right">{s.prezzo_centesimi!=null&&<span className="svc-full-prezzo">€{Math.round(s.prezzo_centesimi/100)}</span>}<span className="svc-full-chev">›</span></div></button>)}<button type="button" className="svc-full-row" onClick={()=>setServiceId(CUSTOM)}><div><div className="svc-full-nome">Servizio personalizzato</div><div className="svc-full-durata">Nome, durata e prezzo per questo appuntamento</div></div><span className="svc-full-chev">›</span></button></div>
   {serviceId===CUSTOM&&<div className="claude-card owner-custom-service"><label>Nome<input value={custom.name} maxLength={120} onChange={e=>setCustom({...custom,name:e.target.value})}/></label><label>Durata (min)<input type="number" min="5" max="480" step="5" value={custom.duration} onChange={e=>setCustom({...custom,duration:e.target.value})}/></label><label>Prezzo €<input type="number" min="0" step="0.01" inputMode="decimal" value={custom.price} onChange={e=>setCustom({...custom,price:e.target.value})}/></label><button type="button" className="claude-primary" disabled={!custom.name.trim()||Number(custom.duration)<5||custom.price===''} onClick={()=>next(3)}>Continua</button></div>}
  </>}
  {step===3&&<><h2>Con chi?</h2><p>Scegli l’operatore che eseguirà {serviceLabel||'il servizio'}.</p><div className="op-full-card">{operators.map(o=><button type="button" key={o.id} className="op-row" onClick={()=>{setOperatorId(o.id);next(4)}}><div className="op-avatar">{o.nome.charAt(0)}</div><div className="op-name">{o.nome}</div><span className="op-chev">›</span></button>)}</div></>}
  {step===4&&<><h2>Quando?</h2><p>{serviceLabel} · {operator?.nome}</p><div className="calendar-head"><button type="button" disabled={month<=new Date(today+'T12:00:00')} onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}>‹</button><strong>{new Intl.DateTimeFormat('it-IT',{month:'long',year:'numeric'}).format(month)}</strong><button type="button" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}>›</button></div><div className="calendar-week">{['LUN','MAR','MER','GIO','VEN','SAB','DOM'].map(x=><span key={x}>{x}</span>)}</div><div className="calendar-grid">{days.map((d,i)=>d===null?<span key={`e${i}`}/>:<button type="button" key={d} disabled={iso(d)<today} onClick={()=>chooseDate(iso(d))} className={iso(d)===date?'selected':''}>{d}<i/></button>)}</div><p className="calendar-legend">● Seleziona un giorno per vedere gli orari disponibili</p></>}
  {step===5&&<><h2>A che ora?</h2><p>{date&&new Intl.DateTimeFormat('it-IT',{dateStyle:'full'}).format(new Date(date+'T12:00:00'))} · {operator?.nome}</p>{loading?<p>Sto cercando gli orari disponibili…</p>:slotError?<p role="alert">Impossibile leggere gli orari disponibili. Torna indietro e riprova.</p>:!slots.length?<><p>Nessun orario disponibile per questo giorno.</p><button type="button" className="claude-secondary full" onClick={()=>next(4)}>Scegli un altro giorno</button></>:['MATTINA','POMERIGGIO'].map((label,index)=>{const group=slots.filter(s=>{const hour=Number(new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',hour12:false}).format(new Date(s.start_at)));return index===0?hour<14:hour>=14});return group.length?<div className="time-section" key={label}><div className="time-section-label">{label}</div><div className="time-chip-wrap">{group.map(s=><button type="button" key={s.start_at} className={`time-chip${s.start_at===selected?' selected':''}`} onClick={()=>chooseTime(s.start_at)}>{new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'}).format(new Date(s.start_at))}</button>)}</div></div>:null})}</>}
  {step===6&&<><h2>Conferma</h2><p>Controlla i dati prima di creare l’appuntamento.</p><div className="claude-card recap"><div><span>Cliente</span><strong>{customerLabel}</strong></div><div><span>Servizio</span><strong>{serviceLabel}<small>{serviceMeta}</small></strong></div><div><span>Operatore</span><strong>{operator?.nome}</strong></div><div><span>Quando</span><strong>{new Intl.DateTimeFormat('it-IT',{dateStyle:'medium'}).format(new Date(date+'T12:00:00'))} · {selected&&new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'}).format(new Date(selected))}</strong></div></div><section className="claude-card recurrence-card">
    <label className="recurrence-switch">
     <span><strong>Ripeti appuntamento</strong><small>Crea automaticamente una serie di appuntamenti.</small></span>
     <input type="checkbox" checked={recurring} onChange={e=>{setRecurring(e.target.checked);clearPreview()}}/>
    </label>
    {recurring&&<div className="recurrence-fields">
     <label>Frequenza<select value={recurrenceType} onChange={e=>{setRecurrenceType(e.target.value);setRecurrenceInterval('1');clearPreview()}}><option value="weekly">Ogni settimana</option><option value="monthly_day">Ogni mese nello stesso giorno</option><option value="monthly_nth_weekday">Giorno specifico del mese</option><option value="custom_weekly">Personalizza settimane…</option><option value="custom_monthly_day">Personalizza mesi · stesso giorno…</option><option value="custom_monthly_nth_weekday">Personalizza mesi · giorno della settimana…</option></select></label>
     {recurrenceType.startsWith('custom_')&&<label>Ripeti ogni<div className="recurrence-interval-row"><input type="number" min="1" max={recurrenceType==='custom_weekly'?52:24} value={recurrenceInterval} onChange={e=>{setRecurrenceInterval(e.target.value);clearPreview()}}/><span>{recurrenceType==='custom_weekly'?(interval===1?'settimana':'settimane'):(interval===1?'mese':'mesi')}</span></div></label>}
     {recurrenceType==='custom_weekly'&&<label>Giorno<select value={weekday} onChange={e=>{setWeekday(Number(e.target.value));clearPreview()}}>{weekdayLabels.map((x,i)=><option value={i} key={x}>{x}</option>)}</select></label>}
     {(recurrenceType==='monthly_nth_weekday'||recurrenceType==='custom_monthly_nth_weekday')&&<div className="recurrence-inline"><label>Settimana<select value={weekOfMonth} onChange={e=>{setWeekOfMonth(Number(e.target.value));clearPreview()}}>{weekLabels.map(x=><option value={x.value} key={x.value}>{x.label}</option>)}</select></label><label>Giorno<select value={weekday} onChange={e=>{setWeekday(Number(e.target.value));clearPreview()}}>{weekdayLabels.map((x,i)=><option value={i} key={x}>{x}</option>)}</select></label></div>}
     <div className="recurrence-summary-line">{recurrenceDescription}</div>
     <div className="owner-booking-mode recurrence-end-tabs"><button type="button" className={recurrenceEndMode==='count'?'active':''} onClick={()=>{setRecurrenceEndMode('count');clearPreview()}}>Dopo N appuntamenti</button><button type="button" className={recurrenceEndMode==='date'?'active':''} onClick={()=>{setRecurrenceEndMode('date');clearPreview()}}>Fino a una data</button></div>
     {recurrenceEndMode==='count'?<label>Numero appuntamenti<input type="number" min="2" max="60" value={recurrenceCount} onChange={e=>{setRecurrenceCount(e.target.value);clearPreview()}}/></label>:<label>Data finale<input type="date" min={date} value={recurrenceEndDate} onChange={e=>{setRecurrenceEndDate(e.target.value);clearPreview()}}/></label>}
     <button type="button" className="claude-secondary full recurrence-preview-button" disabled={previewLoading||(recurrenceEndMode==='count'&&(Number(recurrenceCount)<2||Number(recurrenceCount)>60))||(recurrenceEndMode==='date'&&!recurrenceEndDate)} onClick={runPreview}>{previewLoading?'Verifico disponibilità…':'Verifica ricorrenza'}</button>
     {recurrencePreview&&<div className={'recurrence-preview '+(recurrencePreview.error?'bad':'')}>{recurrencePreview.error?<strong>Impossibile verificare la ricorrenza.</strong>:<><div className="recurrence-preview-counts"><strong>{recurrencePreview.total} previsti</strong><span>{recurrencePreview.available} disponibili</span>{recurrencePreview.conflicts>0&&<span className="conflicts">{recurrencePreview.conflicts} con conflitto</span>}</div>{conflictRows.length>0&&<div className="recurrence-conflicts"><small>Date non disponibili</small>{conflictRows.slice(0,6).map(o=><span key={o.occurrence_no}>{new Intl.DateTimeFormat('it-IT',{dateStyle:'medium'}).format(new Date(o.date+'T12:00:00'))}</span>)}{conflictRows.length>6&&<span>+ altre {conflictRows.length-6}</span>}<p>Alla conferma verranno creati solo gli appuntamenti disponibili.</p></div>}</>}</div>}
    </div>}
   </section>
   <form action={book} className="owner-booking-confirm"><input type="hidden" name="customer_mode" value={customerMode==='existing'?'esistente':'nuovo'}/><input type="hidden" name="customer" value={customerId}/><input type="hidden" name="nome" value={newCustomer.nome}/><input type="hidden" name="cognome" value={newCustomer.cognome}/><input type="hidden" name="email" value={newCustomer.email}/><input type="hidden" name="telefono" value={newCustomer.telefono}/><input type="hidden" name="service" value={serviceId}/><input type="hidden" name="custom_name" value={custom.name}/><input type="hidden" name="custom_duration" value={custom.duration}/><input type="hidden" name="custom_price" value={custom.price}/><input type="hidden" name="operator" value={operatorId}/><input type="hidden" name="date" value={date}/><input type="hidden" name="start" value={selected}/><input type="hidden" name="recurring" value={recurring?'1':'0'}/><input type="hidden" name="recurrence_type" value={recurrenceType}/><input type="hidden" name="recurrence_interval" value={recurrenceInterval}/><input type="hidden" name="recurrence_end_mode" value={recurrenceEndMode}/><input type="hidden" name="recurrence_count" value={recurrenceCount}/><input type="hidden" name="recurrence_end_date" value={recurrenceEndDate}/><input type="hidden" name="recurrence_week_of_month" value={weekOfMonth}/><input type="hidden" name="recurrence_weekday" value={weekday}/><label className="notes-label">Note interne<textarea name="note" maxLength={1000} placeholder="Facoltative"/></label><button className="claude-primary" disabled={recurring&&(!recurrencePreview||recurrencePreview.error||recurrencePreview.available<1)}>{recurring&&recurrencePreview?'Crea '+recurrencePreview.available+' appuntamenti disponibili':'Conferma prenotazione'}</button></form></>}
 </section></div>{bottomNav}</main>
}
