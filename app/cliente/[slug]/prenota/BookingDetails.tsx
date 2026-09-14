'use client';
import {useState} from 'react';
import {useFormStatus} from 'react-dom';
type Props={action:(form:FormData)=>Promise<void>;service:{id:string;nome:string;durata:number;prezzo:number|null};operator:{id:string;nome:string};date:string;slots:{start_at:string}[]};
function Confirm(){const {pending}=useFormStatus();return <button className="btn btn-primary" disabled={pending}>{pending?'Conferma in corso…':'Conferma appuntamento'}</button>;}
export default function BookingDetails({action,service,operator,date,slots}:Props){
 const [review,setReview]=useState<Record<string,string>|null>(null);
 const [selected,setSelected]=useState('');
 const time=(s:string)=>new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'}).format(new Date(s));
 const day=new Intl.DateTimeFormat('it-IT',{dateStyle:'full',timeZone:'Europe/Rome'}).format(new Date(date+'T12:00:00Z'));
 return review?<section className="settings-card"><span className="booking-eyebrow">ULTIMO PASSAGGIO</span><h2>Controlla la tua prenotazione</h2><dl className="booking-summary"><dt>Servizio</dt><dd>{service.nome}</dd><dt>Operatore</dt><dd>{operator.nome}</dd><dt>Quando</dt><dd>{day}<br/>{time(review.start)} – {time(new Date(new Date(review.start).getTime()+service.durata*60000).toISOString())}</dd><dt>Durata</dt><dd>{service.durata} minuti</dd>{service.prezzo!==null && <><dt>Prezzo</dt><dd>{new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(service.prezzo/100)}</dd></>}<dt>Cliente</dt><dd>{review.nome} {review.cognome}<br/>{review.telefono}</dd></dl><form action={action}>{Object.entries({...review,service:service.id,operator:operator.id,date}).map(([name,value])=><input key={name} type="hidden" name={name} value={value}/>)}<Confirm/></form><button className="btn btn-secondary" onClick={()=>setReview(null)}>Modifica i dati</button></section>:<form className="settings-card" onSubmit={e=>{e.preventDefault();setReview(Object.fromEntries(new FormData(e.currentTarget)) as Record<string,string>);}}>
 <span className="booking-eyebrow">PASSAGGIO 2 DI 3</span><h2>Scegli il tuo orario</h2><p>{day}</p>
 <fieldset className="choice-field"><legend>Orari disponibili</legend><div className="slot-grid">{slots.map(s=><label className="slot-choice" key={s.start_at}><input type="radio" name="start" value={s.start_at} checked={selected===s.start_at} onChange={()=>setSelected(s.start_at)} required/><span>{time(s.start_at)}</span></label>)}</div></fieldset>
 <h2>I tuoi dati</h2>{['nome','cognome','telefono'].map(key=><div className="field" key={key}><label htmlFor={key}>{({nome:'Nome',cognome:'Cognome',telefono:'Cellulare'} as Record<string,string>)[key]}</label><input id={key} name={key} type={key==='telefono'?'tel':'text'} maxLength={key==='telefono'?25:120} autoComplete={key==='nome'?'given-name':key==='cognome'?'family-name':'tel'} required/></div>)}<button className="btn btn-primary">Vai al riepilogo</button></form>;
}
