'use client';
import {useRef} from 'react';

export default function AgendaDateFilter({date,operator}:{date:string;operator?:string}){
 const form=useRef<HTMLFormElement>(null);
 return <form ref={form} className="owner-date">
  <label>Data
   <input type="date" name="date" defaultValue={date} onChange={()=>form.current?.requestSubmit()}/>
  </label>
  {operator&&<input type="hidden" name="operator" value={operator}/>}
 </form>
}
