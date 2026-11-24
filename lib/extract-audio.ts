// Repackage standard MP4 AAC samples with ADTS headers, preserving their encoded bytes.
export function extractAudio(buffer:ArrayBuffer){
 const v=new DataView(buffer), bytes=new Uint8Array(buffer),u=(p:number)=>v.getUint32(p);
 type Box={p:number,e:number,t:string};
 function boxes(p:number,e:number){const out:Box[]=[];while(p+8<=e){const n=u(p)||e-p;if(n<8||p+n>e)break;out.push({p:p+8,e:p+n,t:String.fromCharCode(...bytes.subarray(p+4,p+8))});p+=n}return out}
 const find=(b:Box,t:string)=>boxes(b.p,b.e).find(x=>x.t===t);
 const root={p:0,e:buffer.byteLength,t:"root"},moov=find(root,"moov");const fail=()=>{throw Error("This audio codec or container cannot be extracted on this device.")};if(!moov)return fail();
 for(const track of boxes(moov.p,moov.e).filter(x=>x.t==="trak")){
 const mdia=find(track,"mdia"),minf=mdia&&find(mdia,"minf"),stbl=minf&&find(minf,"stbl");if(!stbl)continue;
 const desc=find(stbl,"stsd");if(!desc)continue;const entry=boxes(desc.p+8,desc.e)[0];if(entry?.t!=="mp4a")continue;
 const esds=boxes(entry.p+28,entry.e).find(x=>x.t==="esds");if(!esds)continue;
 const chunk=find(stbl,"stco")||find(stbl,"co64"),sizes=find(stbl,"stsz"),mapping=find(stbl,"stsc");if(!chunk||!sizes||!mapping)continue;
 let freq=-1,channels=0,profile=0;
 for(let i=esds.p+4;i+3<esds.e;i++){if(bytes[i]!==5)continue;let j=i+1,n=0;while(j<esds.e){const b=bytes[j++];n=n*128+(b&127);if(!(b&128))break}if(n<2||j+n>esds.e)continue;const cfg=v.getUint16(j);profile=(cfg>>11)-1;freq=(cfg>>7)&15;channels=(cfg>>3)&15;if(profile>=0&&profile<=3&&freq<=12&&channels>0&&channels<=7)break;freq=-1}
 if(freq<0)return fail();const count=u(sizes.p+8),chunks=u(chunk.p+4),maps=u(mapping.p+4),fixed=u(sizes.p+4);if(!count||!maps||count>buffer.byteLength/2)return fail();
 const parts:BlobPart[]=[];let sample=0,row=0;
 for(let c=0;c<chunks;c++){if(row+1<maps&&u(mapping.p+8+(row+1)*12)<=c+1)row++;let pos=chunk.t==="co64"?Number(v.getBigUint64(chunk.p+8+c*8)):u(chunk.p+8+c*4);const per=u(mapping.p+12+row*12);for(let k=0;k<per&&sample<count;k++,sample++){const size=fixed||u(sizes.p+12+sample*4),len=size+7;if(len>8191||pos+size>buffer.byteLength)return fail();parts.push(new Uint8Array([255,241,(profile<<6)|(freq<<2)|(channels>>2),((channels&3)<<6)|(len>>11),(len>>3)&255,((len&7)<<5)|31,252]),bytes.subarray(pos,pos+size));pos+=size}}
 if(sample===count)return new Blob(parts,{type:"audio/aac"})
 }return fail()
}
