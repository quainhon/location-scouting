import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const testRoot = fileURLToPath(new URL('../.tmp/', import.meta.url));
mkdirSync(testRoot, {recursive:true});
import { join } from 'node:path';
import { openStore } from './store.mjs';
const at='2026-10-02T10:00:00.000Z';
function fixture(){return {revision:0,locations:[{id:'test-location',code:'TEST-001',name:'Test fixture only',region:'',coordinates:{lat:14,lng:109},description:'',scouting_notes:'',camera_angles:[],best_time_to_shoot:'',drone_permitted:false,drive_reference:{asset_count:0},tags:[],status:'active',scouting_status:'candidate',access:'',photos:[],checklist:[{id:'check-1',label:'Verify access',done:false}],history:[{id:'history-1',at,action:'Created'}],created_at:at,updated_at:at}],tours:[{id:'test-tour',code:'TEST-TOUR',title:'Test tour',description:'',status:'planning',production_week:'',assigned_crew:[],stops:[{id:'test-stop',tour_id:'test-tour',location_id:'test-location',stop_order:1,planned_duration_minutes:30,focus_scenes:'',status:'scheduled'}],created_at:at,updated_at:at}]};}
test('fresh database is empty, SQL schema runs, and edits survive reopening',()=>{
 const folder=mkdtempSync(join(testRoot,'scout-test-'));let store;
 try{const filename=join(folder,'test.sqlite');store=openStore(filename);assert.deepEqual(store.read(),{revision:0,locations:[],tours:[]});const saved=store.write(fixture());assert.equal(saved.revision,1);store.close();store=openStore(filename);assert.equal(store.read().locations[0].name,'Test fixture only');assert.equal(store.read().tours[0].stops[0].planned_duration_minutes,30);}finally{store?.close();rmSync(folder,{recursive:true,force:true});}
});
test('removing a stop preserves location, archive and restore preserve checklist',()=>{
 const store=openStore(':memory:');try{let s=store.write(fixture());s.tours[0].stops=[];s=store.write(s);assert.equal(s.locations.length,1);s.locations[0].status='archived';s=store.write(s);assert.equal(s.locations[0].checklist.length,1);s.locations[0].status='active';s.locations[0].checklist[0].done=true;s=store.write(s);assert.equal(s.locations[0].checklist[0].done,true);}finally{store.close();}
});
test('stale revisions, invalid coordinates, orphan stops and hard deletion are rejected without data loss',()=>{
 const store=openStore(':memory:');try{const saved=store.write(fixture());assert.throws(()=>store.write(fixture()),/cửa sổ khác/);let invalid=structuredClone(saved);invalid.locations[0].coordinates.lat=91;assert.throws(()=>store.write(invalid),/Tọa độ/);invalid=structuredClone(saved);invalid.tours[0].stops[0].location_id='missing';assert.throws(()=>store.write(invalid),/Điểm dừng/);invalid=structuredClone(saved);invalid.locations=[];invalid.tours[0].stops=[];assert.throws(()=>store.write(invalid),/Archive/);assert.deepEqual(store.read(),saved);}finally{store.close();}
});
test('unsafe URLs and duplicate IDs are rejected; SQL failure rolls back the transaction',()=>{
 const store=openStore(':memory:');try{const saved=store.write(fixture());let invalid=structuredClone(saved);invalid.locations[0].photos=[{id:'p',url:'javascript:alert(1)',caption:''}];assert.throws(()=>store.write(invalid),/http/);invalid=structuredClone(saved);invalid.locations[0].checklist.push(invalid.locations[0].checklist[0]);assert.throws(()=>store.write(invalid),/trùng lặp/);invalid=structuredClone(saved);invalid.locations.push({...invalid.locations[0],id:'second',checklist:[],history:[]});assert.throws(()=>store.write(invalid),/UNIQUE/);assert.deepEqual(store.read(),saved);}finally{store.close();}
});

