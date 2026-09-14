export type CustomerBranding = {nome?:string;logo_url?:string|null;color_primary?:string|null;color_bg?:string|null;color_text?:string|null};
const color=(v:unknown,f:string)=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)?v:f;
const rgb=(v:string)=>[1,3,5].map(i=>parseInt(v.slice(i,i+2),16));
function mix(a:string,b:string,r:number){const left=rgb(a),right=rgb(b);return '#'+left.map((v,i)=>Math.round(v*(1-r)+right[i]*r).toString(16).padStart(2,'0')).join('');}
function luminance(v:string){const c=rgb(v).map(v=>{const s=v/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;});return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
export function customerTheme(b:CustomerBranding={}){
 const accent=color(b.color_primary,'#C79A45'),bg=color(b.color_bg,'#15130F'),text=color(b.color_text,'#F0E9DB');
 return {'--accent':accent,'--accent-deep':mix(accent,'#000000',.15),'--accent-soft':mix(bg,accent,.12),
 '--bg':bg,'--surface':mix(bg,text,.045),'--surface-2':mix(bg,text,.08),'--border':mix(bg,text,.18),
 '--text':text,'--text-muted':mix(bg,text,.72),'--button-text':luminance(accent)>.179?'#000000':'#FFFFFF'};
}
export function publicLogo(v:unknown):string|null{if(typeof v!=='string')return null;try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
