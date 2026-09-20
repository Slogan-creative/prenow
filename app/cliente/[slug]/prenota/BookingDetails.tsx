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
 recurrenceEnabled:boolean;
};

function Confirm(){
 const {pending}=useFormStatus();
 return <button className="claude-primary" disabled={pending}>{pending?'Conferma in corso…':'Conferma appuntamento'}</button>;
}

export default function BookingDetails({action,service,operator,date,start,profile,recurrenceEnabled}:Props){
 const [repeat,setRepeat]=useState(false),[recurrenceType,setRecurrenceType]=useState('custom_monthly_day'),[interval,setInterval]=useState(1),[weekOfMonth,setWeekOfMonth]=useState(1),[weekday,setWeekday]=useState(new Date(date+'T12:00:00').getDay()),[endMode,setEndMode]=useState('count'),[count,setCount]=useState(6),[endDate,setEndDate]=useState(date);
 const weekdays=['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'],ordinals:[number,string][]=[[1,'primo'],[2,'secondo'],[3,'terzo'],[4,'quarto'],[-1,'ultimo']];
 const wd=weekdays[weekday].toLowerCase(),ord=ordinals.find(x=>x[0]===weekOfMonth)?.[1]||'primo';
 const recurrenceText=recurrenceType==='custom_weekly'?(interval===1?'Ogni '+wd:'Ogni '+interval+' settimane, il '+wd):recurrenceType==='custom_monthly_day'?(interval===1?'Ogni mese, il giorno '+new Date(date+'T12:00:00').getDate():'Ogni '+interval+' mesi, il giorno '+new Date(date+'T12:00:00').getDate()):(interval===1?'Ogni '+ord+' '+wd+' del mese':'Ogni '+ord+' '+wd+', ogni '+interval+' mesi');
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
   {recurrenceEnabled&&<div className="claude-card customer-recurrence"><label className="owner-switch-row"><span><b>Ripeti appuntamento</b><small>Crea automaticamente i prossimi appuntamenti con la stessa durata e lo stesso operatore.</small></span><input type="checkbox" checked={repeat} onChange={e=>setRepeat(e.target.checked)}/></label>{repeat&&<div className="customer-recurrence-options"><label>Frequenza<select name="recurrence_type" value={recurrenceType} onChange={e=>setRecurrenceType(e.target.value)}><option value="custom_weekly">Ogni N settimane</option><option value="custom_monthly_day">Ogni N mesi · stesso giorno</option><option value="custom_monthly_nth_weekday">Ogni N mesi · giorno della settimana</option></select></label><label>Ripeti ogni<div className="recurrence-interval-row"><input name="recurrence_interval" type="number" min="1" max={recurrenceType==='custom_weekly'?52:24} value={interval} onChange={e=>setInterval(Math.max(1,Number(e.target.value)||1))}/><span>{recurrenceType==='custom_weekly'?(interval===1?'settimana':'settimane'):(interval===1?'mese':'mesi')}</span></div></label>{recurrenceType==='custom_weekly'&&<label>Giorno<select name="recurrence_weekday" value={weekday} onChange={e=>setWeekday(Number(e.target.value))}>{weekdays.map((x,i)=><option key={x} value={i}>{x}</option>)}</select></label>}{recurrenceType==='custom_monthly_nth_weekday'&&<div className="recurrence-inline"><label>Settimana<select name="recurrence_week_of_month" value={weekOfMonth} onChange={e=>setWeekOfMonth(Number(e.target.value))}>{ordinals.map(x=><option key={x[0]} value={x[0]}>{x[1][0].toUpperCase()+x[1].slice(1)}</option>)}</select></label><label>Giorno<select name="recurrence_weekday" value={weekday} onChange={e=>setWeekday(Number(e.target.value))}>{weekdays.map((x,i)=><option key={x} value={i}>{x}</option>)}</select></label></div>}<div className="recurrence-summary">{recurrenceText}</div><label>Termina<select name="recurrence_end_mode" value={endMode} onChange={e=>setEndMode(e.target.value)}><option value="count">Dopo un numero di appuntamenti</option><option value="date">A una data</option></select></label>{endMode==='count'?<label>Numero appuntamenti<input name="recurrence_count" type="number" min="2" max="60" value={count} onChange={e=>setCount(Number(e.target.value)||2)}/></label>:<label>Data finale<input name="recurrence_end_date" type="date" min={date} value={endDate} onChange={e=>setEndDate(e.target.value)}/></label>}</div>}<input type="hidden" name="recurrence_enabled" value={repeat?'1':'0'}/></div>}
   <label className="notes-label">Note per il negozio (opzionale)<textarea name="note" placeholder="Es. richieste o preferenze"/></label>
   <Confirm/>
  </form>
 </section>;
}
