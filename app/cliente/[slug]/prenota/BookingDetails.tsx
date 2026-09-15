'use client';
import {useState} from 'react';
import {useFormStatus} from 'react-dom';
type Props={action:(form:FormData)=>Promise<void>;service:{id:string;nome:string;durata:number;prezzo:number|null};operator:{id:string;nome:string};date:string;start:string;profile:{nome:string;cognome:string;telefono:string}};
function Confirm(){const {pending}=useFormStatus();return <button className="claude-primary" disabled={pending}>{pending?'Conferma in corso…':'Conferma appuntamento'}</button>}
export default function BookingDetails({action,service,operator,date,start,profile}:Props){
 const [data,setData]=useState(profile);const day=new Intl.DateTimeFormat('it-IT',{dateStyle:'full',timeZone:'Europe/Rome'}).format(new Date(date+'T12:00:00'));const time=new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'}).format(new Date(start));const price=service.prezzo===null?'—':new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(service.prezzo/100);const complete=data.nome&&data.cognome&&data.telefono;
 return <section className="wizard-body confirmation-step"><p className="step-copy">Passaggio 5 di 5</p><div className="progress-five">{[1,2,3,4,5].map(n=><span key={n} className="on"/>)}</div><h2>Conferma</h2><div className="claude-card confirmation-hero"><strong>{service.nome} con {operator.nome}</strong><span>{day} alle {time}</span><small>{service.durata} min · {price}</small></div><form action={action}><input type="hidden" name="service" value={service.id}/><input type="hidden" name="operator" value={operator.id}/><input type="hidden" name="date" value={date}/><input type="hidden" name="start" value={start}/>
 {!complete&&<div className="claude-card compact-form"><p>Completa i dati del profilo</p>{(['nome','cognome','telefono'] as const).map(k=><label key={k}>{k==='telefono'?'Cellulare':k.charAt(0).toUpperCase()+k.slice(1)}<input name={k} value={data[k]} onChange={e=>setData({...data,[k]:e.target.value})} required/></label>)}</div>}
 {complete&&<><input type="hidden" name="nome" value={data.nome}/><input type="hidden" name="cognome" value={data.cognome}/><input type="hidden" name="telefono" value={data.telefono}/></>}
 <label className="notes-label">Note per il negozio (opzionale)<textarea name="note" placeholder="Es. richieste o preferenze"/></label><Confirm/></form></section>;
}
