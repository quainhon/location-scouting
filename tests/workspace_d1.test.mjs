import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');
import { readFileSync } from 'node:fs';
import { onRequest } from '../functions/api/workspace';

const at='2026-10-05T00:00:00.000Z';
function fixture() {
 const spot={id:'spot',code:'SPOT',name:'Test only',region:'',coordinates:{lat:14,lng:109},description:'',scouting_notes:'',camera_angles:[],best_time_to_shoot:'',drone_permitted:false,drive_reference:{asset_count:0},tags:[],status:'active',scouting_status:'candidate',access:'',photos:[{id:'photo',url:'https://example.com/photo.jpg',caption:'Photo'}],checklist:[{id:'check',label:'Access',done:false}],history:[{id:'history',at,action:'Created'}],created_at:at,updated_at:at};
 return {revision:0,locations:[spot],tours:[{id:'tour',code:'TOUR',title:'Test route',description:'',status:'planning',production_week:'',assigned_crew:[],created_at:at,updated_at:at,stops:[{id:'stop',tour_id:'tour',location_id:'spot',stop_order:1,planned_duration_minutes:30,focus_scenes:'',status:'scheduled'}]}]};
}
function database() {
 const sql=new DatabaseSync(':memory:');
 const schema=readFileSync(new URL('../database/schema.sql',import.meta.url),'utf8');
 sql.exec(schema.split('-- Short video metadata')[0]);
 const db={prepare(query){let values=[];return {
   bind(...v){values=v;return this;},
   async first(){return sql.prepare(query).get(...values)??null;},
   async all(){return {results:sql.prepare(query).all(...values)};},
   async run(){return sql.prepare(query).run(...values);},
 };},async batch(statements){sql.exec('BEGIN');try{for(const s of statements)await s.run();sql.exec('COMMIT');}catch(e){sql.exec('ROLLBACK');throw e;}}};
 return {db,close:()=>sql.close()};
}
async function call(db,state) {
 return onRequest({request:new Request('https://scout.test/api/workspace',state?{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(state)}:{}),env:{location_scout_db:db}});
}
describe('Cloudflare workspace compatibility using real SQLite SQL',()=>{
 it('migrates the old schema and preserves photos, checklist, routes and video through legacy edits and archive',async()=>{
  const {db,close}=database();try {
   expect((await call(db)).status).toBe(200);
   let state=fixture();state.locations[0].videos=[{id:'video',url:'/api/videos/'+'a'.repeat(64),caption:'Clip',duration:15}];
   let response=await call(db,state);expect(response.status).toBe(200);state=await response.json();
   delete state.locations[0].videos;state.locations[0].scouting_notes='Legacy edit';
   response=await call(db,state);expect(response.status).toBe(200);state=await response.json();expect(state.locations[0].videos).toHaveLength(1);
   state.locations[0].status='archived';state=await(await call(db,state)).json();
   expect(state.locations[0].photos).toHaveLength(1);expect(state.locations[0].checklist).toHaveLength(1);expect(state.tours[0].stops).toHaveLength(1);
   expect(state.locations[0].videos[0].duration).toBe(15);
   const stale=structuredClone(state);stale.revision--;expect((await call(db,stale)).status).toBe(409);
   expect(await(await call(db)).json()).toEqual(state);
  }finally{close();}
 });
 it('deletes a spot and links atomically, while rejecting orphan routes',async()=>{
  const {db,close}=database();try {
   const state=await(await call(db,fixture())).json();
   const orphan=structuredClone(state);orphan.locations=[];expect((await call(db,orphan)).status).toBe(400);
   expect(await(await call(db)).json()).toEqual(state);
   state.locations=[];state.tours[0].stops=[];
   const response=await call(db,state);expect(response.status).toBe(200);
   const deleted=await response.json();expect(deleted.locations).toEqual([]);expect(deleted.tours[0].stops).toEqual([]);
  }finally{close();}
 });
 it('keeps one location when a client retries the same UUID after losing the first response',async()=>{
  const {db,close}=database();try {
   const captureId='550e8400-e29b-41d4-a716-446655440000';
   const capture=fixture();capture.locations[0].id=captureId;capture.locations[0].code='QN-LOC-550E8400';capture.tours[0].stops[0].location_id=captureId;
   const firstResponse=await call(db,capture);expect(firstResponse.status).toBe(200);
   // Simulate a committed create whose HTTP response is lost before the phone can clear its queue.
   const recovered=await(await call(db)).json();
   expect(recovered.locations.map(location=>location.id)).toEqual([captureId]);
   const retry=await call(db,recovered);expect(retry.status).toBe(200);
   const afterRetry=await retry.json();
   expect(afterRetry.locations.filter(location=>location.id===captureId)).toHaveLength(1);
   expect((await db.prepare('SELECT COUNT(*) AS count FROM scout_locations WHERE id=?').bind(captureId).first()).count).toBe(1);
   expect(afterRetry.locations[0].photos).toHaveLength(1);
  }finally{close();}
 });
});
