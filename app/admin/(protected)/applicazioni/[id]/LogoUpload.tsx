'use client';
import {useEffect,useRef,useState} from 'react';
import {useFormStatus} from 'react-dom';
import {uploadLogo} from './logo-actions';
function Submit(){const {pending}=useFormStatus();return <button className="btn btn-primary" disabled={pending}>{pending?'Caricamento…':'Salva logo'}</button>;}
export default function LogoUpload({tenant,logo}:{tenant:string;logo:string|null}){
 const [preview,setPreview]=useState(logo),[error,setError]=useState(''),[ready,setReady]=useState(false);
 const output=useRef<HTMLInputElement>(null);const sequence=useRef(0);
 useEffect(()=>()=>{sequence.current++;},[]);
 async function choose(file?:File){const token=++sequence.current;setReady(false);setError('');if(output.current)output.current.value='';if(!file){setPreview(logo);return;}
  if(file.size>2*1024*1024||!['image/png','image/jpeg','image/svg+xml'].includes(file.type)){setError('Scegli JPG, PNG o SVG, massimo 2 MB.');return;}
  const url=URL.createObjectURL(file);
  try{const img=new Image();img.src=url;await img.decode();if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth*img.naturalHeight>25000000)throw Error();
   const scale=Math.min(1,1024/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
   canvas.getContext('2d')!.drawImage(img,0,0,canvas.width,canvas.height);const data=canvas.toDataURL('image/png');
   if(token!==sequence.current)return;if(data.length>2800000)throw Error();if(output.current)output.current.value=data;setPreview(data);setReady(true);
  }catch{if(token===sequence.current)setError('Immagine non leggibile. Prova a esportarla in PNG.');}finally{URL.revokeObjectURL(url);}
 }
 return <form action={uploadLogo} className="settings-card" style={{margin:'20px 0'}}>
  <input type="hidden" name="tenant" value={tenant}/><input ref={output} type="hidden" name="image"/>
  <h3>Carica o sostituisci il logo</h3>
  {preview&&<img src={preview} alt="Anteprima logo" width={120} height={120} style={{objectFit:'contain',maxWidth:'100%'}}/>}
  <div className="field"><label htmlFor="logo-file">JPG, PNG o SVG · massimo 2 MB</label><input id="logo-file" type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={e=>choose(e.target.files?.[0])}/></div>
  <p className="field-hint">Le immagini vengono ottimizzate in PNG; gli SVG non vengono pubblicati come codice attivo. Il logo attuale resta invariato finché non salvi.</p>
  {error&&<p role="alert">{error}</p>}{ready&&<Submit/>}
 </form>;
}
