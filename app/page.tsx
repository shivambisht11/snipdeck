"use client";
import {useEffect,useRef,useState} from "react";
import {ArrowDownToLine,Film,Headphones,Clipboard,Link2,Zap,Copy,Check,CircleHelp,X,LoaderCircle,Camera,Command,SlidersHorizontal} from "lucide-react";
import {extractAudio} from "../lib/extract-audio";
type Item={id:string,kind:string,label:string,ext:string};
const platforms=["YouTube","Instagram","Facebook","Pinterest"];
function Brand({name}:{name:string}){return <span className={'brandIcon '+name}>{name==='YouTube'?<i/>:name==='Instagram'?<Camera size={22}/>:name==='Facebook'?'f':'℗'}</span>}
export default function Page(){
 const [url,U]=useState(""),[mode,M]=useState("video"),[error,E]=useState(""),[busy,B]=useState(false),[data,D]=useState<{title:string,source:string,items:Item[],poster?:string}|null>(null),[choice,C]=useState(0),[help,H]=useState(false),[copied,K]=useState(false),[host,S]=useState(""),[saving,V]=useState(false);
 const [adsConfigured,setAdsConfigured]=useState(false);
 const input=useRef<HTMLInputElement>(null), dialog=useRef<HTMLDialogElement>(null),seq=useRef(0);
 useEffect(()=>{S(location.host);setAdsConfigured(!!document.querySelector('meta[name="google-adsense-account"]'));const params=new URLSearchParams(location.search);if(location.pathname==="/download"&&params.get("mode")==="audio")M("audio");const path=location.pathname.slice(1);const incoming=new URLSearchParams(location.search).get("url")|| (path?path+location.search:"");if(incoming){const value=/^https?:/.test(incoming)?incoming:"https://"+incoming;U(value);void resolve(value)}},[]);
 useEffect(()=>{if(help)dialog.current?.showModal();else dialog.current?.close()},[help]);
 async function resolve(value:string){const id=++seq.current;D(null);E("");B(false);let u;try{u=new URL(value.includes("://")?value:"https://"+value);if(!/^https?:$/.test(u.protocol)||!/(^|\.)(youtube\.com|youtu\.be|instagram\.com|facebook\.com|fb\.watch|fb\.com|pinterest\.com|pin\.it)$/.test(u.hostname))throw Error()}catch{E("Enter a video link from one of the four platforms below.");input.current?.focus();return}B(true);try{const r=await fetch("/api/media?url="+encodeURIComponent(u.href));const x=await r.json();if(!r.ok)throw Error(x.error);if(seq.current===id){D({...x,source:u.href});C(0)}}catch(e){if(seq.current===id)E(e instanceof Error?e.message:"Couldn’t load this link. Try again.")}finally{if(seq.current===id)B(false)}}
 let optionsHref="";
 if(adsConfigured && url.trim()){
   try{
     const text=url.trim();
     const target=new URL(text.includes("://")?text:"https://"+text);
     if(target.protocol==="https:"&&!target.port&&!target.username&&!target.password&&/(^|\.)(youtube\.com|youtu\.be|instagram\.com|facebook\.com|fb\.watch|fb\.com|pinterest\.com|pin\.it)$/.test(target.hostname)){
       optionsHref="/download?"+new URLSearchParams({url:target.href,mode}).toString();
     }
   }catch{}
 }
 const items=data?.items.filter(i=>i.kind===mode)||[];const extraction=mode==="audio"&&!items.length?data?.items.find(i=>i.kind==="video"&&i.ext==="mp4"):null;const item=items[choice]||items[0]||extraction;
 async function paste(){try{const t=await navigator.clipboard.readText();if(!t)throw Error();U(t);D(null);E("");seq.current++;B(false)}catch{E("Tap the link field and choose Paste to insert your URL.")}input.current?.focus()}
 async function save() {
   if (!data || !item || saving) return;
   V(true);
   E("");
   try {
     const query = new URLSearchParams({url:data.source,file:String(item.id)});
     const response = await fetch("/api/media?" + query, {cache:"no-store"});
     const type = (response.headers.get("content-type") || "").split(";")[0];
     if (!response.ok || !type.startsWith(item.kind + "/")) {
       const reason = type === "application/json" ? await response.json().catch(() => null) : null;
       throw Error(reason?.error || "The platform could not deliver this file. Try the link again.");
     }
     if (extraction && Number(response.headers.get("content-length")) > 120000000)
       throw Error("This file is too large for audio extraction on this device.");
     const file = await response.blob();
     const bytes = new Uint8Array(await file.slice(0,12).arrayBuffer());
     const mp4 = String.fromCharCode(...bytes.slice(4,8)) === "ftyp";
     const webm = bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
     if (!(item.ext === "webm" ? webm : mp4))
       throw Error("The platform returned an invalid media file. Try another video.");
     const output = extraction ? extractAudio(await file.arrayBuffer()) : file;
     const link = document.createElement("a");
     link.href = URL.createObjectURL(output);
     link.download = data.title.replace(/[\/\\]/g,"-") + "." + (extraction ? "aac" : item.ext);
     document.body.appendChild(link);
     link.click();
     link.remove();
     setTimeout(() => URL.revokeObjectURL(link.href),60000);
   } catch (e) { E(e instanceof Error ? e.message : "Download failed. Please try again."); }
   finally { V(false); }
 }
 return <><header><div className="nav"><a className="wordmark" href="/"><img src="/favicon.svg" alt=""/>Snipdeck</a><button className="help" onClick={()=>H(true)}><CircleHelp size={17}/>How it works</button></div></header><main><section className="hero"><div className="heroCopy"><div className="eyebrow"><span/> MEDIA DOWNLOADER</div><h1>Save the video.<br/><em>Keep the quality.</em></h1><p>Download videos and audio from your favorite platforms.</p></div><img className="art" src="/deck.svg" alt="Stacked media player with a lime download arrow"/></section>
 <section className="card"><div className="cardTitle"><h2>Download media</h2><SlidersHorizontal size={21}/></div><div className="tabs">{["video","audio"].map(m=><button key={m} aria-pressed={mode===m} className={mode===m?"active":""} onClick={()=>{M(m);C(0);E("")}}>{m==="video"?<Film size={19}/>:<Headphones size={19}/>} {m==="video"?"Video":"Audio only"}</button>)}</div>
 <form onSubmit={e=>{e.preventDefault();resolve(url.trim())}}><label htmlFor="url">Media link</label><div className="entry"><Link2 size={20}/><input id="url" type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" ref={input} placeholder="Paste your video link here" value={url} onChange={e=>{U(e.target.value);D(null);E("");seq.current++;B(false)}}/><button type="button" className="paste" onClick={paste}><Clipboard size={16}/>Paste</button></div>{!data&&(optionsHref&&!busy?<a className="primary optionsLink" href={optionsHref}><ArrowDownToLine/>Get download options</a>:<button className="primary" disabled={busy}>{busy?<LoaderCircle className="spin"/>:<ArrowDownToLine/>}{busy?"Finding media…":"Get download options"}</button>)}</form>
 {error&&<p role="alert" className="err">{error}</p>}{data&&<div className="result">{data.poster&&<img src={data.poster} alt="" referrerPolicy="no-referrer"/>}<strong>{data.title}</strong>{items.length>0&&<select aria-label="Download quality" value={choice} onChange={e=>C(+e.target.value)}>{items.map((i,n)=><option key={i.id} value={n}>{i.label}</option>)}</select>}{item?<button className="primary" disabled={saving} onClick={save}><ArrowDownToLine/>{saving?(extraction?"Extracting audio…":"Downloading…"):"Download "+mode}</button>:<p>This source has no downloadable {mode} track.</p>}</div>}
 <div className="platforms"><span className="muted">Works with</span>{platforms.map(p=><span className="platform" key={p}><Brand name={p}/>{p}</span>)}</div></section>
 <section className="shortcut"><div className="zap"><Zap fill="currentColor"/></div><div className="shortcutBody"><h2>The URL shortcut</h2><p>Add our domain before the video address to open it here.</p><div className="code"><code><b>{host||"your-domain"}/</b>youtu.be/video-id</code><button title="Copy shortcut prefix" aria-label="Copy shortcut prefix" onClick={async()=>{try{await navigator.clipboard.writeText(location.origin+"/");K(true);setTimeout(()=>K(false),1800)}catch{H(true)}}}>{copied?<Check size={17}/>:<Copy size={17}/>}</button></div></div></section></main>
 <dialog ref={dialog} onCancel={()=>H(false)}><button className="close" aria-label="Close help" onClick={()=>H(false)}><X/></button><div className="zap"><Command/></div><h2>How it works</h2><ol><li>Copy a public video link you have permission to download.</li><li>Paste it here and choose Video or Audio only.</li><li>Get download options, choose a quality and save the file.</li></ol><h3>Skip the paste</h3><p>Insert <b>{host}/</b> just after <b>https://</b> in a video address. The download page opens with the link filled in.</p></dialog></>
}
