'use client';
import {useMemo,useState} from 'react';
import Link from 'next/link';

type Service={id:string;nome:string;durata_min:number;prezzo_centesimi:number|null};
type Operator={id:string;nome:string};
type Customer={id:string;nome:string;cognome:string|null;email:string|null;telefono:string|null};
type Slot={start_at:string};
type CustomService={name:string;duration:string;price:string};

export default function ManualBookingWizard({
 slug,today,services,operators,customers,initialCustomer,availability,book
}:{
 slug:string;today:string;services:Service[];operators:Operator[];customers:Customer[];initialCustomer?:string;
 availability:(service:string,operator:string,date:string,customName:string,customDuration:number)=>Promise<{slots:Slot[];error:boolean}>;
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
 async function chooseDate(value:string){
  setDate(value);setSelected('');setSlots([]);setSlotError(false);setLoading(true);next(5);
  const duration=serviceId===CUSTOM?Number(custom.duration):0;
  try{const r=await availability(serviceId,operatorId,value,custom.name,duration);setSlots(r.slots);setSlotError(r.error)}catch{setSlotError(true)}finally{setLoading(false)}
 }
 const serviceLabel=serviceId===CUSTOM?custom.name:service?.nome||'';
 const serviceMeta=serviceId===CUSTOM?`${custom.duration} min · €${custom.price||'0'}`:service?`${service.durata_min} min${service.prezzo_centesimi==null?'':` · €${Math.round(service.prezzo_centesimi/100)}`}`:'';
 const customerLabel=customerMode==='existing'?selectedCustomer?`${selectedCustomer.nome} ${selectedCustomer.cognome||''}`.trim():'':`${newCustomer.nome} ${newCustomer.cognome}`.trim();

 return <main className="customer-ui owner-booking-ui"><div className="customer-app booking-flow">{header}<section className="wizard-body">{progress}
  {step===1&&<><h2>Per chi?</h2><p>Scegli un cliente esistente oppure creane uno nuovo.</p><div className="owner-booking-mode"><button type="button" className={customerMode==='existing'?'active':''} onClick={()=>setCustomerMode('existing')}>Cliente esistente</button><button type="button" className={customerMode==='new'?'active':''} onClick={()=>setCustomerMode('new')}>Nuovo cliente</button></div>
   {customerMode==='existing'?<><input className="owner-booking-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cerca per nome, email o telefono"/><div className="owner-customer-choice">{filtered.map(c=><button type="button" key={c.id} className={customerId===c.id?'selected':''} onClick={()=>{setCustomerId(c.id);next(2)}}><span className="op-avatar">{c.nome.charAt(0)}</span><span><strong>{c.nome} {c.cognome||''}</strong><small>{c.email||c.telefono||'Nessun contatto'}</small></span><b>›</b></button>)}</div></>:<div className="claude-card owner-new-customer"><label>Nome<input value={newCustomer.nome} onChange={e=>setNewCustomer({...newCustomer,nome:e.target.value})}/></label><label>Cognome<input value={newCustomer.cognome} onChange={e=>setNewCustomer({...newCustomer,cognome:e.target.value})}/></label><label>Email<input type="email" value={newCustomer.email} onChange={e=>setNewCustomer({...newCustomer,email:e.target.value})}/></label><label>Telefono<input type="tel" value={newCustomer.telefono} onChange={e=>setNewCustomer({...newCustomer,telefono:e.target.value})}/></label><button type="button" className="claude-primary" disabled={!canUseNew} onClick={()=>next(2)}>Continua</button></div>}
  </>}
  {step===2&&<><h2>Cosa deve fare?</h2><p>Scegli un servizio del catalogo oppure creane uno personalizzato per questo appuntamento.</p><div className="svc-full-card">{services.map(s=><button type="button" key={s.id} className="svc-full-row" onClick={()=>{setServiceId(s.id);next(3)}}><div><div className="svc-full-nome">{s.nome}</div><div className="svc-full-durata">{s.durata_min} min</div></div><div className="svc-full-right">{s.prezzo_centesimi!=null&&<span className="svc-full-prezzo">€{Math.round(s.prezzo_centesimi/100)}</span>}<span className="svc-full-chev">›</span></div></button>)}<button type="button" className="svc-full-row" onClick={()=>setServiceId(CUSTOM)}><div><div className="svc-full-nome">Servizio personalizzato</div><div className="svc-full-durata">Nome, durata e prezzo per questo appuntamento</div></div><span className="svc-full-chev">›</span></button></div>
   {serviceId===CUSTOM&&<div className="claude-card owner-custom-service"><label>Nome<input value={custom.name} maxLength={120} onChange={e=>setCustom({...custom,name:e.target.value})}/></label><label>Durata (min)<input type="number" min="5" max="480" step="5" value={custom.duration} onChange={e=>setCustom({...custom,duration:e.target.value})}/></label><label>Prezzo €<input type="number" min="0" step="0.01" inputMode="decimal" value={custom.price} onChange={e=>setCustom({...custom,price:e.target.value})}/></label><button type="button" className="claude-primary" disabled={!custom.name.trim()||Number(custom.duration)<5||custom.price===''} onClick={()=>next(3)}>Continua</button></div>}
  </>}
  {step===3&&<><h2>Con chi?</h2><p>Scegli l’operatore che eseguirà {serviceLabel||'il servizio'}.</p><div className="op-full-card">{operators.map(o=><button type="button" key={o.id} className="op-row" onClick={()=>{setOperatorId(o.id);next(4)}}><div className="op-avatar">{o.nome.charAt(0)}</div><div className="op-name">{o.nome}</div><span className="op-chev">›</span></button>)}</div></>}
  {step===4&&<><h2>Quando?</h2><p>{serviceLabel} · {operator?.nome}</p><div className="calendar-head"><button type="button" disabled={month<=new Date(today+'T12:00:00')} onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}>‹</button><strong>{new Intl.DateTimeFormat('it-IT',{month:'long',year:'numeric'}).format(month)}</strong><button type="button" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}>›</button></div><div className="calendar-week">{['LUN','MAR','MER','GIO','VEN','SAB','DOM'].map(x=><span key={x}>{x}</span>)}</div><div className="calendar-grid">{days.map((d,i)=>d===null?<span key={`e${i}`}/>:<button type="button" key={d} disabled={iso(d)<today} onClick={()=>chooseDate(iso(d))} className={iso(d)===date?'selected':''}>{d}<i/></button>)}</div><p className="calendar-legend">● Seleziona un giorno per vedere gli orari disponibili</p></>}
  {step===5&&<><h2>A che ora?</h2><p>{date&&new Intl.DateTimeFormat('it-IT',{dateStyle:'full'}).format(new Date(date+'T12:00:00'))} · {operator?.nome}</p>{loading?<p>Sto cercando gli orari disponibili…</p>:slotError?<p role="alert">Impossibile leggere gli orari disponibili. Torna indietro e riprova.</p>:!slots.length?<><p>Nessun orario disponibile per questo giorno.</p><button type="button" className="claude-secondary full" onClick={()=>next(4)}>Scegli un altro giorno</button></>:['MATTINA','POMERIGGIO'].map((label,index)=>{const group=slots.filter(s=>{const hour=Number(new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',hour12:false}).format(new Date(s.start_at)));return index===0?hour<14:hour>=14});return group.length?<div className="time-section" key={label}><div className="time-section-label">{label}</div><div className="time-chip-wrap">{group.map(s=><button type="button" key={s.start_at} className={`time-chip${s.start_at===selected?' selected':''}`} onClick={()=>{setSelected(s.start_at);next(6)}}>{new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'}).format(new Date(s.start_at))}</button>)}</div></div>:null})}</>}
  {step===6&&<><h2>Conferma</h2><p>Controlla i dati prima di creare l’appuntamento.</p><div className="claude-card recap"><div><span>Cliente</span><strong>{customerLabel}</strong></div><div><span>Servizio</span><strong>{serviceLabel}<small>{serviceMeta}</small></strong></div><div><span>Operatore</span><strong>{operator?.nome}</strong></div><div><span>Quando</span><strong>{new Intl.DateTimeFormat('it-IT',{dateStyle:'medium'}).format(new Date(date+'T12:00:00'))} · {selected&&new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'}).format(new Date(selected))}</strong></div></div><form action={book} className="owner-booking-confirm"><input type="hidden" name="customer_mode" value={customerMode==='existing'?'esistente':'nuovo'}/><input type="hidden" name="customer" value={customerId}/><input type="hidden" name="nome" value={newCustomer.nome}/><input type="hidden" name="cognome" value={newCustomer.cognome}/><input type="hidden" name="email" value={newCustomer.email}/><input type="hidden" name="telefono" value={newCustomer.telefono}/><input type="hidden" name="service" value={serviceId}/><input type="hidden" name="custom_name" value={custom.name}/><input type="hidden" name="custom_duration" value={custom.duration}/><input type="hidden" name="custom_price" value={custom.price}/><input type="hidden" name="operator" value={operatorId}/><input type="hidden" name="date" value={date}/><input type="hidden" name="start" value={selected}/><label className="notes-label">Note interne<textarea name="note" maxLength={1000} placeholder="Facoltative"/></label><button className="claude-primary">Conferma prenotazione</button></form></>}
 </section></div></main>
}
