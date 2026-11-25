const sites=["youtube.com","youtu.be","facebook.com","fb.com","fb.watch","instagram.com","pin.it","pinterest.com"];
const cdns=["googlevideo.com","fbcdn.net","cdninstagram.com","pinimg.com"];
const allowed=(s:string,domains:string[])=>{try{const u=new URL(s);return u.protocol==="https:"&&!u.username&&!u.password&&!u.port&&domains.some(d=>u.hostname===d||u.hostname.endsWith("."+d))}catch{return false}};
async function readSource(url:string,domains:string[],headers:Record<string,string>={}){
 for(let i=0;i<6&&allowed(url,domains);i++){const r=await fetch(url,{redirect:"manual",headers:{"User-Agent":"Mozilla/5.0 (compatible; Snipdeck/1.0)","Accept-Language":"en-US,en;q=0.9",...headers},signal:AbortSignal.timeout(20000)});if(r.status>=300&&r.status<400){const loc=r.headers.get("location");if(!loc)break;url=new URL(loc,url).href;continue}if(r.ok)return r;break}throw Error("The platform did not make this media available.")
}
const clean=(s:string)=>s.replace(/&amp;|&#38;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">");
function meta(h:string,n:string){for(const m of h.matchAll(/<meta\b[^>]*>/gi)){const attrs:Record<string,string>={};for(const a of m[0].matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g))attrs[a[1].toLowerCase()]=clean(a[3]);if((attrs.property||attrs.name)===n)return attrs.content||""}return ""}
type Media={src:string,kind:string,label:string,ext:string,rank:number};
function collect(h:string){const media:Media[]=[];function add(src:string,kind:string,label:string,ext:string,rank:number){if(allowed(src,cdns)&&!media.some(x=>x.src===src))media.push({src,kind,label,ext,rank})}
 const start=h.match(/ytInitialPlayerResponse\s*=\s*/);if(start){const sub=h.slice(start.index!+start[0].length);let depth=0,quote=false;for(let i=0;i<sub.length;i++){const c=sub[i];if(quote&&c==="\\"){i++;continue}if(c==='"')quote=!quote;if(quote)continue;if(c==="{")depth++;if(c==="}"&&--depth===0){try{const p=JSON.parse(sub.slice(0,i+1)),s=p.streamingData||{};for(const f of s.formats||[])if(f.url)add(f.url,"video",f.qualityLabel||"Source video",f.mimeType.includes("mp4")?"mp4":"webm",f.height||0);for(const f of s.adaptiveFormats||[])if(f.url&&f.mimeType.startsWith("audio/"))add(f.url,"audio",Math.round(f.bitrate/1000)+" kbps",f.mimeType.includes("mp4")?"m4a":"webm",f.bitrate)}catch{}break}}}
 for(const prop of ["og:video:secure_url","og:video:url","og:video"]){const src=meta(h,prop);if(src&&!/\.m3u8|\.mpd/.test(src))add(src,"video","Source video","mp4",0)}
 for(const m of h.matchAll(/"(playable_url_quality_hd|browser_native_hd_url|playable_url|browser_native_sd_url|video_url|contentUrl|url)"\s*:\s*("(?:[^"\\]|\\.)*")/g)){try{const src=clean(JSON.parse(m[2]));if((m[1]==="url"||m[1]==="contentUrl")&&!/\.mp4(?:\?|$)/i.test(src))continue;if(/\.m3u8|\.mpd/i.test(src))continue;const hd=m[1].includes("hd");add(src,"video",hd?"HD video":"Source video","mp4",hd?1000:0)}catch{}}
 return media.sort((a,b)=>b.rank-a.rank)
}
function watchUrl(source: string) {
 const u = new URL(source);
 const isYoutube = u.hostname === "youtu.be" || /(^|\.)youtube\.com$/.test(u.hostname);
 if (!isYoutube) return source;
 const id = u.hostname === "youtu.be" ? u.pathname.slice(1) :
   u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]+)/)?.[1] || u.searchParams.get("v");
 return id && /^[\w-]{11}$/.test(id) ? "https://www.youtube.com/watch?v=" + id : source;
}

function isMedia(response: Response, item: Media) {
 const type = (response.headers.get("content-type") || "").split(";")[0].trim();
 return response.body && (type.startsWith(item.kind + "/") || type === "application/octet-stream");
}

async function accessible(item: Media) {
 try {
   const response = await readSource(item.src, cdns, { Range: "bytes=0-31" });
   const valid = !!isMedia(response, item) && response.headers.get("content-length") !== "0";
   void response.body?.cancel().catch(() => {});
   return valid;
 } catch { return false; }
}

export async function GET(req: Request) {
 const query = new URL(req.url).searchParams;
 const source = query.get("url") || "";
 if (!allowed(source, sites)) return Response.json({error:"Enter a supported HTTPS video link."},{status:400});
 try {
   const canonical = watchUrl(source);
   const pages = [...new Set([canonical, source])];
   for (const pageUrl of pages) {
     let page: Response;
     try { page = await readSource(pageUrl, sites); } catch { continue; }
     const html = await page.text();
     const items = collect(html);
     const title = (meta(html,"og:title") || "Saved media").slice(0,180);
     const ids = items.map((item, i) => {
       const itag = new URL(item.src).searchParams.get("itag");
       return itag ? "yt-" + itag : String(i);
     });
     if (query.has("file")) {
       const item = items[ids.indexOf(query.get("file")!)];
       if (!item) continue;
       let media: Response;
       try { media = await readSource(item.src, cdns); } catch { continue; }
       if (!isMedia(media, item) || media.status !== 200 || media.headers.get("content-length") === "0") {
         void media.body?.cancel().catch(() => {});
         continue;
       }
       const headers = new Headers({
         "content-disposition": "attachment; filename*=UTF-8''" + encodeURIComponent(title + "." + item.ext),
         "content-type": item.kind + "/" + (item.ext === "m4a" ? "mp4" : item.ext),
         "cache-control": "private, no-store"
       });
       const size = media.headers.get("content-length");
       if (size && !media.headers.has("content-encoding")) headers.set("content-length", size);
       return new Response(media.body, {headers});
     }
     const offered = [];
     for (let i = 0; i < items.length; i++) {
       const item = items[i];
       if (allowed(item.src, ["googlevideo.com"]) && !(await accessible(item))) continue;
       offered.push({id:ids[i],kind:item.kind,label:item.label,ext:item.ext});
     }
     if (offered.length) {
       const poster = meta(html,"og:image");
       return Response.json({title,poster:allowed(poster,[...cdns,"ytimg.com"])?poster:undefined,items:offered},
         {headers:{"cache-control":"private, no-store"}});
     }
   }
   throw Error("The platform did not provide an accessible media file for this video.");
 } catch (e) {
   return Response.json({error:e instanceof Error ? e.message : "Couldn’t retrieve this video."},
     {status:422,headers:{"cache-control":"no-store"}});
 }
}
