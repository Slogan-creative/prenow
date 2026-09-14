'use client';
import {useEffect,useState} from 'react';
type InstallEvent=Event & {prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
export default function InstallApp({slug}:{slug:string}){
 const [event,setEvent]=useState<InstallEvent|null>(null),[message,setMessage]=useState('');
 useEffect(()=>{
  const handler=(e:Event)=>{e.preventDefault();setEvent(e as InstallEvent);};
  const installed=()=>{setEvent(null);setMessage('Applicazione aggiunta.');};
  window.addEventListener('beforeinstallprompt',handler);window.addEventListener('appinstalled',installed);
  if('serviceWorker' in navigator)navigator.serviceWorker.register(`/cliente/${slug}/sw.js`,{scope:`/cliente/${slug}`}).catch(()=>{});
  return ()=>{window.removeEventListener('beforeinstallprompt',handler);window.removeEventListener('appinstalled',installed);};
 },[slug]);
 return <aside className="customer-install" aria-label="Installazione applicazione">{event&&<button className="btn" onClick={async()=>{await event.prompt();await event.userChoice;setEvent(null);}}>Installa applicazione</button>}<details><summary>Aggiungi alla schermata Home</summary><p>Su iPhone/iPad: apri in Safari, scegli Condividi e “Aggiungi alla schermata Home”. Sugli altri browser cerca “Installa” o “Aggiungi alla schermata Home” nel menu. È necessaria una connessione per accedere e prenotare.</p></details>{message&&<p role="status">{message}</p>}</aside>;
}
