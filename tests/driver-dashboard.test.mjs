import {test} from 'node:test';
import assert from 'node:assert/strict';
import {boardingSummary,filterPassengers,activeTrip,nextStop} from '../src/driver-dashboard.js';
import {DriverCamera} from '../src/driver-camera.js';
test('counts and filters include only valid boardings and search booking/name/seat',()=>{
 const passengers=[{valid:true,name:'Amina',seat:'12A',ticket:'TKT-00000001',bookingReference:'BK-DEMO',boardedAt:'now'},{valid:true,name:'Osman',seat:'1'},{valid:false,name:'Refunded',boardedAt:'now'}];
 assert.deepEqual(boardingSummary({passengers}),{total:2,boarded:1,waiting:1,percent:50});assert.equal(boardingSummary(null).percent,0);
 for(const query of ['amina','12a','bk-demo','tkt-00000001'])assert.equal(filterPassengers(passengers,query).length,1);
 assert.equal(filterPassengers(passengers,'','waiting').length,1);assert.equal(filterPassengers(passengers,'','boarded').length,1);assert.equal(filterPassengers(passengers,'missing').length,0);
});
test('trip selection and next stop never invent an intermediate-stop ETA',()=>{
 assert.equal(activeTrip([{id:1,status:'canceled'},{id:2,status:'published',journey:'scheduled',departureAt:'2026-11-12'},{id:3,status:'published',journey:'departed',departureAt:'2026-11-13'}]).id,3);
 const stops=[{nameEn:'A'},{nameEn:'B'},{nameEn:'C'}];assert.equal(nextStop({stops,events:[]}).nameEn,'A');assert.equal(nextStop({stops,events:[{event:'departed'}]}),null);assert.equal(nextStop({stops:stops.slice(0,2),events:[{event:'departed'}]}).nameEn,'B');assert.equal(nextStop({stops,events:[{event:'arrived'}]}),null);
});
const environment=(media,userAgent='')=>({navigator:{userAgent,mediaDevices:{getUserMedia:media}},isSecureContext:true,jsQR:()=>null,document:{hidden:false,addEventListener(){},removeEventListener(){},createElement:()=>({getContext:()=>({})})},addEventListener(){},removeEventListener(){},setTimeout});
test('camera refuses old Driver/Booking clients and reports permission denial',async()=>{
 let calls=0;for(const ua of ['SafeerApp/17000 (driver)','SafeerApp/18000 (booking)']){const c=new DriverCamera({environment:environment(()=>{calls++;},ua)});assert.equal(await c.start(),false);assert.match(c.state.code,/APP_UPDATE_REQUIRED|DRIVER_APP_REQUIRED/);c.destroy();}assert.equal(calls,0);
 const c=new DriverCamera({environment:environment(async()=>{throw Object.assign(Error(),{name:'NotAllowedError'});})});assert.equal(await c.start(),false);assert.equal(c.state.code,'CAMERA_PERMISSION_DENIED');c.destroy();
});
test('camera stops a late permission stream after navigation and requests no audio',async()=>{
 let resolve,stopped=0,request;const c=new DriverCamera({environment:environment(options=>{request=options;return new Promise(r=>resolve=r);})});const pending=c.start();c.stop();resolve({getTracks:()=>[{stop:()=>stopped++}]});assert.equal(await pending,false);assert.equal(stopped,1);assert.equal(request.audio,false);c.destroy();
});
