'use client';
import {useRef,useState} from 'react';
import {saveOperatorHours,toggleOperatorActive,toggleOperatorService} from '../actions';

type TimeRange={da:string;a:string};
type Hours={weekday:number;chiuso:boolean;fasce:(TimeRange|string[])[]};
const DAYS=[['Lunedì',1],['Martedì',2],['Mercoledì',3],['Giovedì',4],['Venerdì',5],['Sabato',6],['Domenica',0]] as const;
const normalize=(value:TimeRange|string[]):TimeRange=>Array.isArray(value)?{da:value[0]||'',a:value[1]||''}:value;

export function OperatorStatus({slug,id,active}:{slug:string;id:string;active:boolean}){
 const form=useRef<HTMLFormElement>(null),[checked,setChecked]=useState(active);
 return <form ref={form} action={toggleOperatorActive}><input type="hidden" name="slug" value={slug}/><input type="hidden" name="operator_id" value={id}/><input type="hidden" name="attivo" value={checked?'on':'off'}/><label className="owner-op-status"><span>{checked?'Attivo':'Non attivo'}</span><input type="checkbox" checked={checked} onChange={e=>{setChecked(e.target.checked);requestAnimationFrame(()=>form.current?.requestSubmit())}}/></label></form>
}

export function OperatorServices({slug,id,services,assigned}:{slug:string;id:string;services:{id:string;nome:string}[];assigned:string[]}){
 const [selected,setSelected]=useState(new Set(assigned));
 return <><p className="owner-permission-note">Quali servizi del catalogo può eseguire questo operatore. Il catalogo si gestisce da Impostazioni → Servizi.</p><section className="owner-panel owner-service-list">{services.map(service=>{const enabled=selected.has(service.id);return <form action={toggleOperatorService} key={service.id}><input type="hidden" name="slug" value={slug}/><input type="hidden" name="operator_id" value={id}/><input type="hidden" name="service_id" value={service.id}/><input type="hidden" name="enabled" value={enabled?'off':'on'}/><button className="owner-service-toggle" onClick={()=>setSelected(current=>{const next=new Set(current);enabled?next.delete(service.id):next.add(service.id);return next})}><span>{service.nome}</span><span className={`owner-switch ${enabled?'on':''}`} aria-label={enabled?'Assegnato':'Non assegnato'}/></button></form>})}</section></>
}

export function OperatorHours({slug,id,hours}:{slug:string;id:string;hours:Hours[]}){
 const map=new Map(hours.map(h=>[h.weekday,h])),[selected,setSelected]=useState<Hours|null>(null);
 return <><section className="owner-panel owner-compact-list">{DAYS.map(([label,weekday])=>{const day=map.get(weekday)||{weekday,chiuso:true,fasce:[]};const text=day.chiuso?'Chiuso':day.fasce.map(normalize).map(f=>`${f.da}–${f.a}`).join(', ')||'Orario non impostato';return <button className="owner-day-row" key={weekday} onClick={()=>setSelected(day)}><div><b>{label}</b><span className={day.chiuso?'closed':''}>{text}</span></div><EditIcon/></button>})}</section>{selected?<HoursModal slug={slug} id={id} value={selected} close={()=>setSelected(null)}/>:null}</>
}

function EditIcon(){return <span className="owner-row-edit-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></span>}
function HoursModal({slug,id,value,close}:{slug:string;id:string;value:Hours;close:()=>void}){
 const [closed,setClosed]=useState(value.chiuso),[ranges,setRanges]=useState(value.fasce.length?value.fasce.map(normalize):[{da:'09:00',a:'13:00'}]);
 const label=DAYS.find(([,day])=>day===value.weekday)?.[0]||'Orario';
 return <div className="owner-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.currentTarget===e.target)close()}}><section className="owner-modal" role="dialog" aria-modal="true" aria-label={label}><header><h2>{label}</h2><button onClick={close} aria-label="Chiudi">×</button></header><form action={saveOperatorHours} className="owner-form"><input type="hidden" name="slug" value={slug}/><input type="hidden" name="operator_id" value={id}/><input type="hidden" name="weekday" value={value.weekday}/><label className="owner-switch-row">Chiuso<input type="checkbox" name="chiuso" checked={closed} onChange={e=>setClosed(e.target.checked)}/></label>{!closed?<>{ranges.map((f,i)=><div className="owner-range-row" key={i}><input type="time" name="start" value={f.da} onChange={e=>setRanges(ranges.map((x,n)=>n===i?{...x,da:e.target.value}:x))}/><span>–</span><input type="time" name="end" value={f.a} onChange={e=>setRanges(ranges.map((x,n)=>n===i?{...x,a:e.target.value}:x))}/><button type="button" aria-label="Elimina fascia" onClick={()=>setRanges(ranges.filter((_,n)=>n!==i))}>×</button></div>)}<button type="button" className="owner-add-range" onClick={()=>setRanges([...ranges,{da:'09:00',a:'13:00'}])}>+ Aggiungi fascia oraria</button></>:null}<button className="owner-primary">Salva</button></form></section></div>
}
