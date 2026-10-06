import { describe, expect, it, vi } from 'vitest';
import { videoDuration, videoResponse, MAX_VIDEO_BYTES, type VideoStorage } from '../shared/videos.mjs';
import { onRequest } from '../functions/api/videos/[id]';
import { uploadVideos } from '../src/utils/videos';

function box(type: string, body: Uint8Array) {
  const bytes = new Uint8Array(8 + body.length); new DataView(bytes.buffer).setUint32(0,bytes.length);
  bytes.set([...type].map(c => c.charCodeAt(0)),4); bytes.set(body,8); return bytes;
}
function concat(...parts: Uint8Array[]) { const bytes=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){bytes.set(p,at);at+=p.length;}return bytes; }
function clip(seconds=15) {
  const timing = new Uint8Array(24); const view=new DataView(timing.buffer);view.setUint32(12,1000);view.setUint32(16,Math.round(seconds*1000));
  const handler = new Uint8Array(24);handler.set([118,105,100,101],8);
  return concat(box('ftyp',new Uint8Array([105,115,111,109,0,0,0,0])),box('moov',concat(box('mvhd',timing),box('trak',box('mdia',concat(box('mdhd',timing),box('hdlr',handler)))))),box('mdat',new Uint8Array([1,2,3])));
}
const hash=async(bytes:Uint8Array)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes)))].map(b=>b.toString(16).padStart(2,'0')).join('');
function storage():VideoStorage{const entries=new Map();return {get:async id=>entries.get(id)||null,put:async(id,asset)=>{entries.set(id,asset);}};}
const put=(id:string,bytes:Uint8Array,headers:Record<string,string>={})=>new Request('https://scout.test/api/videos/'+id,{method:'PUT',headers:{'Content-Type':'video/mp4',...headers},body:new Uint8Array(bytes)});

describe('15 second video upload and playback',()=>{
  it('allows 15 seconds and rejects longer, zero and corrupt containers',()=>{
    expect(videoDuration(clip(15))).toBe(15);expect(videoDuration(clip(3))).toBe(3);
    expect(()=>videoDuration(clip(15.001))).toThrow(/15/);expect(()=>videoDuration(clip(0))).toThrow();
    expect(()=>videoDuration(clip().slice(0,30))).toThrow();
  });
  it('persists verified timing and bytes and supports seeking and HEAD',async()=>{
    const db=storage(),bytes=clip(),id=await hash(bytes);
    expect(await (await videoResponse(put(id,bytes),id,db)).json()).toEqual({url:'/api/videos/'+id,duration:15});
    const get=await videoResponse(new Request('https://scout.test'),id,db);expect(new Uint8Array(await get.arrayBuffer())).toEqual(bytes);
    const range=await videoResponse(new Request('https://scout.test',{headers:{Range:'bytes=8-15'}}),id,db);
    expect(range.status).toBe(206);expect(new Uint8Array(await range.arrayBuffer())).toEqual(bytes.slice(8,16));
    const suffix=await videoResponse(new Request('https://scout.test',{headers:{Range:'bytes=-5'}}),id,db);expect(new Uint8Array(await suffix.arrayBuffer())).toEqual(bytes.slice(-5));
    expect((await videoResponse(new Request('https://scout.test',{headers:{Range:'bytes=99999-'}}),id,db)).status).toBe(416);
    const head=await videoResponse(new Request('https://scout.test',{method:'HEAD'}),id,db);expect(head.headers.get('content-length')).toBe(String(bytes.length));expect(await head.text()).toBe('');
  });
  it('rejects long uploads on server without trusting client metadata',async()=>{
    const bytes=clip(16),id=await hash(bytes),db=storage();
    expect((await videoResponse(put(id,bytes,{'X-Duration':'5'}),id,db)).status).toBe(415);expect(await db.get(id)).toBeNull();
  });
  it('rejects wrong type, cross origin, missing asset and mismatched hashes',async()=>{
    const bytes=clip(3),id=await hash(bytes),db=storage();
    expect((await videoResponse(put(id,bytes,{'Content-Type':'text/html'}),id,db)).status).toBe(415);
    expect((await videoResponse(put(id,bytes,{origin:'https://other.test'}),id,db)).status).toBe(403);
    expect((await videoResponse(put('a'.repeat(64),bytes),'a'.repeat(64),db)).status).toBe(400);
    expect((await videoResponse(new Request('https://scout.test'),id,db)).status).toBe(404);
  });
  it('enforces actual streamed bytes even with no Content-Length',async()=>{
    expect((await videoResponse(put('a'.repeat(64),new Uint8Array(MAX_VIDEO_BYTES+1)),'a'.repeat(64),storage())).status).toBe(413);
  });
  it('Pages adapter stores chunks and returns the original MP4',async()=>{
    let asset:{mime:string;duration:number;size:number}|null=null;const chunks=new Map<number,number[]>();
    const db={prepare(sql:string){let values:unknown[]=[];return {
      bind(...v:unknown[]){values=v;return this;},
      async first<T>(){return (sql.includes('scout_video_assets')?asset:chunks.has(Number(values[1]))?{bytes:chunks.get(Number(values[1]))}:null) as T|null;},
      async run(){if(sql.startsWith('INSERT OR IGNORE INTO scout_video_assets'))asset={mime:String(values[1]),duration:Number(values[2]),size:Number(values[3])};if(sql.startsWith('INSERT OR IGNORE INTO scout_video_chunks'))chunks.set(Number(values[1]),[...new Uint8Array(values[2] as ArrayBuffer)]);},
    };},async batch(statements:{run:()=>Promise<unknown>}[]){for(const s of statements)await s.run();}};
    const bytes=clip(2),id=await hash(bytes);
    expect((await onRequest({request:put(id,bytes),params:{id},env:{location_scout_db:db}})).status).toBe(200);
    const get=await onRequest({request:new Request('https://scout.test'),params:{id},env:{location_scout_db:db}});
    expect(new Uint8Array(await get.arrayBuffer())).toEqual(bytes);
  });
  it('client keeps retry drafts after failed upload and returns saved metadata on success',async()=>{
    const bytes=clip(2),id=await hash(bytes);const draft={id:'draft',blob:new File([bytes],'clip.mp4',{type:'video/mp4'}),name:'clip.mp4',preview:'blob:test',duration:2,mime:'video/mp4'};
    const fetchMock=vi.spyOn(globalThis,'fetch');
    try {
      fetchMock.mockResolvedValueOnce(Response.json({error:'Network problem'},{status:503}));
      await expect(uploadVideos([draft],()=>{})).rejects.toThrow('Network problem');expect(draft.blob.size).toBe(bytes.length);
      fetchMock.mockResolvedValueOnce(Response.json({url:'/api/videos/'+id,duration:2}));
      expect(await uploadVideos([draft],()=>{})).toEqual([{id:'draft',url:'/api/videos/'+id,caption:'clip.mp4',duration:2}]);
    }finally{fetchMock.mockRestore();}
  });
});
