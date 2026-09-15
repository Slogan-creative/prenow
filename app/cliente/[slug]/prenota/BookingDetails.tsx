'use client';

import {useState} from 'react';
import {useFormStatus} from 'react-dom';

type Profile={nome:string;cognome:string;email:string;telefono:string;guest:boolean};
type Props={
 action:(form:FormData)=>Promise<void>;
 service:{id:string;nome:string;durata:number;prezzo:number|null};
 operator:{id:string;nome:string};
 date:string;
 start:string;
 profile:Profile;
};

function Confirm(){
 const {pending}=useFormStatus();
 return <button className="claude-primary" disabled={pending}>{pending?'Conferma in corso…':'Conferma appuntamento'}</button>;
}

export default function BookingDetails({action,service,operator,date,start,profile}:Props){
 const [data,setData]=useState(profile);
 const day=new Intl.DateTimeFormat('it-IT',{dateStyle:'full',timeZone:'Europe/Rome'}).format(new Date(date+'T12:00:00'));
 const time=new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'}).format(new Date(start));
 const price=service.prezzo===null?'—':new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(service.prezzo/100);
 const complete=Boolean(data.nome.trim()&&data.cognome.trim()&&data.telefono.trim()&&data.email.trim());

 return <section className="wizard-body confirmation-step">
  <p className="step-copy">Passaggio 5 di 5</p>
  <div className="progress-five">{[1,2,3,4,5].map(n=><span key={n} className="on"/>)}</div>
  <h2>Conferma</h2>
  <div className="claude-card confirmation-hero">
   <strong>{service.nome} con {operator.nome}</strong>
   <span>{day} alle {time}</span>
   <small>{service.durata} min · {price}</small>
  </div>
  <form action={action}>
   <input type="hidden" name="service" value={service.id}/>
   <input type="hidden" name="operator" value={operator.id}/>
   <input type="hidden" name="date" value={date}/>
   <input type="hidden" name="start" value={start}/>
   {!complete&&<div className="claude-card compact-form">
    <p>{profile.guest?'Inserisci i dati per la prenotazione':'Completa i dati del profilo'}</p>
    <label>Nome<input name="nome" value={data.nome} onChange={e=>setData({...data,nome:e.target.value})} autoComplete="given-name" maxLength={120} required/></label>
    <label>Cognome<input name="cognome" value={data.cognome} onChange={e=>setData({...data,cognome:e.target.value})} autoComplete="family-name" maxLength={120} required/></label>
    {profile.guest
     ?<label>Email<input name="email" type="email" value={data.email} onChange={e=>setData({...data,email:e.target.value})} autoComplete="email" required/></label>
     :<input type="hidden" name="email" value={data.email}/>}
    <label>Cellulare<input name="telefono" type="tel" value={data.telefono} onChange={e=>setData({...data,telefono:e.target.value})} autoComplete="tel" maxLength={25} required/></label>
    {profile.guest&&<small>I dati saranno usati per gestire questo appuntamento, senza creare un account.</small>}
   </div>}
   {complete&&<>
    <input type="hidden" name="nome" value={data.nome}/>
    <input type="hidden" name="cognome" value={data.cognome}/>
    <input type="hidden" name="email" value={data.email}/>
    <input type="hidden" name="telefono" value={data.telefono}/>
   </>}
   <label className="notes-label">Note per il negozio (opzionale)<textarea name="note" placeholder="Es. richieste o preferenze"/></label>
   <Confirm/>
  </form>
 </section>;
}
