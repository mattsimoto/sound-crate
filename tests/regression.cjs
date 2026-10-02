const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
function section(start,end){return script.slice(script.indexOf(start),script.indexOf(end,script.indexOf(start)));}
const noop=()=>{};
function buffer(channels,length,sampleRate){
  const data=Array.from({length:channels},()=>new Float32Array(length));
  return {numberOfChannels:channels,length,sampleRate,duration:length/sampleRate,getChannelData:c=>data[c]};
}
async function run(){
  const context=vm.createContext({Float32Array,Uint8Array,DataView,Array,Number,Math,btoa,atob,
    audio:()=>({createBuffer:buffer})});
  vm.runInContext(section('function packBuffer','async function saveProject'),context);
  const original=buffer(2,32,48000);
  original.getChannelData(0).set([0,0.125,-0.5,1,-1]);
  original.getChannelData(1).set([0.7,-0.3]);
  const packed=context.packBuffer(original), restored=context.unpackBuffer(JSON.parse(JSON.stringify(packed)));
  for(let c=0;c<2;c++) assert.deepEqual(restored.getChannelData(c),original.getChannelData(c));
  assert.throws(()=>context.unpackBuffer({...packed,length:0}));
  assert.throws(()=>context.unpackBuffer({...packed,channels:['broken']}));
  const nodes={};
  const slot={gen:0,item:{},buffer:{},peaks:{},part:3,lock:true,mute:true,solo:true,vol:0.2,panV:-1,stemUrl:'blob:old',
    el:{querySelector:s=>nodes[s]??= {value:null,removeAttribute:noop},classList:{remove:noop}}};
  let revoked;
  Object.assign(context,{stopPadSources:noop,padTimer:null,padRecording:false,padEvents:[],padTake:null,padAssignments:[],
    $:()=>({disabled:false}),stop:noop,state:{session:1,renderToken:2},bpmTimer:null,clearTimeout:noop,
    past:[],future:[],updateHistoryButtons:noop,
    cache:new Map([['old',{}]]),slots:[slot],setPressed:noop,applyMix:noop,updateSlotUI:noop,updateButtons:noop,
    URL:{revokeObjectURL:u=>revoked=u}});
  vm.runInContext(section('function newSession','function addFiles'),context);
  context.newSession();
  assert.equal(context.state.session,2); assert.equal(context.state.renderToken,3);
  assert.equal(slot.mute,false); assert.equal(slot.solo,false); assert.equal(slot.lock,false);
  assert.equal(slot.vol,0.8); assert.equal(slot.panV,0); assert.equal(slot.buffer,null);
  assert.equal(revoked,'blob:old'); assert.equal(context.cache.size,0);
  let resolveOld;
  const oldBuffer=new Promise(resolve=>resolveOld=resolve);
  Object.assign(context,{state:{session:1,queue:[{id:'old'}],ready:[],analyzing:false,checked:0,skipped:0,started:false},
    getBuffer:it=>it.id==='old'?oldBuffer:Promise.resolve({}),analyze:()=>({ok:true}),
    updateStatus:noop,rerollAll:async()=>{},play:noop,sleep:async()=>{},toast:noop});
  vm.runInContext(section('async function analyzeLoop','/* =================== slots'),context);
  const oldRun=context.analyzeLoop();
  context.state.session=2; context.state.queue=[{id:'new'}]; context.state.checked=0;
  await context.analyzeLoop(); resolveOld({}); await oldRun;
  for(let i=0;i<10;i++) await Promise.resolve();
  assert.equal(context.state.checked,1); assert.equal(context.state.ready[0].id,'new');
  assert.equal(context.state.analyzing,false);
  console.log('PASS: syntax, exact stereo audio round trip, invalid audio rejection, full reset, folder-switch analysis handoff');
}
run().catch(err=>{console.error(err);process.exitCode=1;});
