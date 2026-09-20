'use client';

import {useMemo,useState} from 'react';

type Appointment={
 id:string;
 start_at:string;
 end_at:string;
 stato:string;
 operator_id:string;
 customer:string;
 operator:string;
 service:string;
 series_id?:string|null;
 occurrence_number?:number|null;
};

const statusClass=(value:string)=>{
 const s=value.toLowerCase();
 if(s==='confermato')return 'confirmed';
 if(s==='completato')return 'completed';
 if(s.includes('cancell'))return 'cancelled';
 if(s.includes('show')||s.includes('assente'))return 'noshow';
 return 'neutral';
};

const isoLocal=(d:Date)=>[
 d.getFullYear(),
 String(d.getMonth()+1).padStart(2,'0'),
 String(d.getDate()).padStart(2,'0')
].join('-');

export default function AgendaProgram({appointments,today}:{appointments:Appointment[];today:string}){
 const [calendarOpen,setCalendarOpen]=useState(false);
 const [selectedDate,setSelectedDate]=useState(today);
 const [month,setMonth]=useState(()=>new Date(today+'T12:00:00'));
 const [notice,setNotice]=useState('');

 const groups=useMemo(()=>{
  const map=new Map<string,Appointment[]>();
  for(const item of appointments){
   const key=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome'}).format(new Date(item.start_at));
   const arr=map.get(key)||[];
   arr.push(item);map.set(key,arr);
  }
  return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
 },[appointments]);

 const appointmentDates=useMemo(()=>new Set(groups.map(([d])=>d)),[groups]);
 const fmtTime=new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'});
 const fmtWeekday=new Intl.DateTimeFormat('it-IT',{weekday:'short',timeZone:'Europe/Rome'});
 const fmtDay=new Intl.DateTimeFormat('it-IT',{day:'2-digit',timeZone:'Europe/Rome'});
 const fmtMonthShort=new Intl.DateTimeFormat('it-IT',{month:'short',timeZone:'Europe/Rome'});
 const monthTitle=new Intl.DateTimeFormat('it-IT',{month:'long',year:'numeric'}).format(month);

 const calendarDays=useMemo(()=>{
  const y=month.getFullYear(),m=month.getMonth();
  const first=(new Date(y,m,1).getDay()+6)%7;
  const total=new Date(y,m+1,0).getDate();
  return [...Array(first).fill(null),...Array.from({length:total},(_,i)=>i+1)];
 },[month]);

 function selectDate(day:number){
  const value=isoLocal(new Date(month.getFullYear(),month.getMonth(),day,12));
  setSelectedDate(value);
  const exact=document.getElementById('agenda-day-'+value);
  if(exact){
   setNotice('');
   exact.scrollIntoView({behavior:'smooth',block:'start'});
   return;
  }
  const next=groups.find(([d])=>d>value);
  if(next){
   setNotice('Nessun appuntamento in questa data. Ti porto al prossimo giorno con appuntamenti.');
   requestAnimationFrame(()=>document.getElementById('agenda-day-'+next[0])?.scrollIntoView({behavior:'smooth',block:'start'}));
  }else{
   setNotice('Nessun appuntamento da questa data in avanti nel periodo caricato.');
  }
 }

 if(!groups.length)return <div className="owner-empty">Nessun appuntamento futuro nel periodo visualizzato.</div>;

 return <div className="agenda-program">
  <div className="agenda-program-toolbar">
   <button type="button" className="agenda-month-toggle" onClick={()=>setCalendarOpen(v=>!v)} aria-expanded={calendarOpen}>
    <span>{monthTitle}</span>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={calendarOpen?'m6 15 6-6 6 6':'m6 9 6 6 6-6'}/></svg>
   </button>
   <button type="button" className="agenda-today" onClick={()=>{
    const d=new Date(today+'T12:00:00');setMonth(d);
    const exact=document.getElementById('agenda-day-'+today);
    if(exact)exact.scrollIntoView({behavior:'smooth',block:'start'});else selectDate(d.getDate());
   }}>Oggi</button>
  </div>

  {calendarOpen&&<div className="agenda-calendar">
   <div className="agenda-calendar-head">
    <button type="button" aria-label="Mese precedente" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}>‹</button>
    <strong>{monthTitle}</strong>
    <button type="button" aria-label="Mese successivo" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}>›</button>
   </div>
   <div className="agenda-weekdays">{['L','M','M','G','V','S','D'].map((d,i)=><span key={i}>{d}</span>)}</div>
   <div className="agenda-calendar-grid">
    {calendarDays.map((day,i)=>day===null?<span key={'e'+i}/>:(()=>{
      const value=isoLocal(new Date(month.getFullYear(),month.getMonth(),day,12));
      const active=value===selectedDate;
      const isToday=value===today;
      return <button type="button" key={value} className={(active?'selected ':'')+(isToday?'today ':'')} onClick={()=>selectDate(day)}>
       <span>{day}</span>{appointmentDates.has(value)&&<i/>}
      </button>
    })())}
   </div>
  </div>}

  {notice&&<div className="agenda-program-notice">{notice}</div>}

  <div className="agenda-program-list">
   {groups.map(([date,items])=>{
    const d=new Date(date+'T12:00:00');
    const isToday=date===today;
    return <section className="agenda-day-section" id={'agenda-day-'+date} data-date={date} key={date}>
     <div className="agenda-day-marker">
      <span>{fmtWeekday.format(d).replace('.','').toUpperCase()}</span>
      <strong>{fmtDay.format(d)}</strong>
      <small>{fmtMonthShort.format(d).replace('.','').toUpperCase()}</small>
      {isToday&&<i>OGGI</i>}
     </div>
     <div className="agenda-day-content">
      <div className="agenda-day-appointments">
       {items.map(a=><article className="agenda-program-item" key={a.id}>
        <div className="agenda-program-copy">
         <div className="agenda-program-primary"><time>{fmtTime.format(new Date(a.start_at))}</time><b>{a.customer}</b></div>
         <span>{a.service} · {a.operator}</span>
         {a.series_id&&<small>↻ Ricorrente{a.occurrence_number?' · #'+a.occurrence_number:''}</small>}
        </div>
        {statusClass(String(a.stato))==='confirmed'
         ? <em className="confirmed agenda-status-check" aria-label="Confermato" title="Confermato">✓</em>
         : <em className={statusClass(String(a.stato))}>{String(a.stato).replace(/_/g,' ')}</em>}
       </article>)}
      </div>
     </div>
    </section>
   })}
  </div>
 </div>
}
