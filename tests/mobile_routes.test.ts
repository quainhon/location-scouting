import { describe, expect, it } from 'vitest';
import { drivingUrl, googleMapsDirectionsUrl, parseDrivingRoute, routeKey } from '../src/utils/routing';
import { populateTour } from '../src/utils/invariants';
import type { ScoutLocation, Tour } from '../src/types/scout';
const date='2026-10-03T00:00:00Z';
const tour:Tour={id:'test-tour',code:'TEST',title:'Test',description:'',status:'planning',production_week:'',assigned_crew:[],stops:[],created_at:date,updated_at:date};
const spot=(id:string,status:'active'|'archived'='active'):ScoutLocation=>({id,code:id,name:id,region:'',coordinates:{lat:13.77,lng:109.22},description:'',scouting_notes:'',camera_angles:[],best_time_to_shoot:'',drone_permitted:false,drive_reference:{asset_count:0},tags:[],status,created_at:date,updated_at:date});
describe('tour builder',()=>{
 it('preserves checkbox order and leaves library and existing tours unchanged',()=>{const locations=[spot('a'),spot('b'),spot('c')];const before=JSON.stringify(locations);const result=populateTour(tour,locations,['c','a','b','a']);expect(result.stops.map(s=>s.location_id)).toEqual(['c','a','b']);expect(result.stops.map(s=>s.stop_order)).toEqual([1,2,3]);expect(tour.stops).toEqual([]);expect(JSON.stringify(locations)).toBe(before);});
 it('rejects empty, stale, or archived selections',()=>{expect(()=>populateTour(tour,[],[])).toThrow();expect(()=>populateTour(tour,[spot('a','archived')],['a'])).toThrow();expect(()=>populateTour(tour,[spot('a')],['missing'])).toThrow();});
});
describe('road routing',()=>{
 it('requests car routing in longitude/latitude order and supplied stop sequence',()=>{const p=[{lat:13.7,lng:109.2},{lat:14.1,lng:109.1}];expect(drivingUrl(p)).toContain('driving/109.200000,13.700000;109.100000,14.100000');expect(drivingUrl(p)).toContain('geometries=geojson');expect(routeKey(p)).not.toEqual(routeKey([...p].reverse()));});
 it('converts real route geometry to Leaflet coordinates and flags distant road access',()=>{const result=parseDrivingRoute({code:'Ok',routes:[{distance:2500,duration:500,geometry:{type:'LineString',coordinates:[[109.2,13.7],[109.21,13.71],[109.22,13.72]]}}],waypoints:[{distance:200}]});expect(result.points).toEqual([[13.7,109.2],[13.71,109.21],[13.72,109.22]]);expect(result.offRoad).toBe(true);});
 it('does not fabricate a straight route on failure or accept invalid geometry',()=>{expect(()=>parseDrivingRoute({code:'NoRoute'})).toThrow();expect(()=>parseDrivingRoute({code:'Ok',routes:[{distance:10,duration:10,geometry:{type:'LineString',coordinates:[[999,1],[2,3]]}}]})).toThrow();expect(()=>drivingUrl([{lat:999,lng:1},{lat:2,lng:3}])).toThrow();});
});
describe('Google Maps route links',()=>{
 const points=Array.from({length:6},(_,index)=>({lat:13.7+index/100,lng:109.2+index/100}));
 it('uses the displayed point order as origin, waypoints, and destination',()=>{
  const url=new URL(googleMapsDirectionsUrl(points.slice(0,4),true));
  expect(url.searchParams.get('origin')).toBe('13.700000,109.200000');
  expect(url.searchParams.get('waypoints')).toBe('13.710000,109.210000|13.720000,109.220000');
  expect(url.searchParams.get('destination')).toBe('13.730000,109.230000');
  expect(url.searchParams.get('travelmode')).toBe('driving');
 });
 it('rejects mobile and desktop waypoint limits without truncating the route',()=>{
  expect(()=>googleMapsDirectionsUrl(points,true)).toThrow(/tối đa 5 điểm/);
  expect(()=>googleMapsDirectionsUrl(Array.from({length:12},(_,index)=>({lat:13+index/100,lng:109})),false)).toThrow(/tối đa 11 điểm/);
 });
 it('rejects a single stop and invalid coordinates',()=>{
  expect(()=>googleMapsDirectionsUrl(points.slice(0,1),false)).toThrow(/ít nhất 2 điểm/);
  expect(()=>googleMapsDirectionsUrl([{lat:91,lng:0},{lat:0,lng:0}],false)).toThrow(/tọa độ/);
 });
});
