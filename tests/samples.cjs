const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const script=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const createBuffer=(channels,length,sampleRate)=>{const data=Array.from({length:channels},()=>new Float32Array(length));return {numberOfChannels:channels,length,sampleRate,duration:length/sampleRate,getChannelData:c=>data[c]};};
const sandbox={Math,Date,Float32Array,console,audio:()=>({createBuffer}),mtof:m=>440*2**((m-69)/12),DEMOS:[]};
const context=vm.createContext(sandbox);
vm.runInContext(script.slice(script.indexOf('const EXTRA_DEMOS'),script.indexOf('async function renderDemo')),context);
for(const d of sandbox.DEMOS.filter(d=>d.kind)){
  const b=context.proceduralSample(d,16000);assert.equal(b.numberOfChannels,2);assert.equal(b.duration,9.6);
  for(let c=0;c<2;c++){const x=b.getChannelData(c);assert.ok(x.every(v=>Number.isFinite(v)&&Math.abs(v)<=.8));assert.ok(x.reduce((s,v)=>s+v*v,0)/x.length>1e-5,d.name);assert.ok(x[0]===0);assert.ok(Math.abs(x.at(-1))<.002);}
}
for(const d of sandbox.DEMOS.filter(d=>d.folder?.startsWith('Brass'))){
  const events=[];d.play({brass:(t,dur,note,kind,gain=.3)=>events.push({t,dur,note,kind,gain})},s=>s*.6/4);
  assert.ok(events.length>0);assert.ok(events.every(e=>e.t>=0&&e.dur>0&&e.t+e.dur<=9.6&&e.note>=24&&e.note<=96&&e.gain>0&&e.gain<=.3),d.name);
}
assert.equal(sandbox.DEMOS.length,26);
async function run(){
  const original={id:'original',name:'My recording'};
  Object.assign(sandbox,{state:{session:1,ready:[original],queue:[],checked:1,busy:false,analyzing:false},ctx:{sampleRate:16000},newSession:()=>assert.fail('Appending must not reset the session'),openCrate:()=>{},setStatus:()=>{},updateButtons:()=>{},updateStatus:()=>{},toast:()=>{},sleep:async()=>{},renderDemo:async d=>context.proceduralSample(d,8000),analyzeLoop:async()=>{sandbox.state.ready.push(...sandbox.state.queue);sandbox.state.queue=[];}});
  vm.runInContext(script.slice(script.indexOf('async function loadDemo'),script.indexOf('/* =================== UI wiring')),context);
  await context.loadDemo('voice',true);assert.equal(sandbox.state.ready.length,9);assert.equal(sandbox.state.ready[0],original);assert.ok(sandbox.state.ready.slice(1).every(d=>d.folder==='Voice pack (synthetic)'));
  await context.loadDemo('voice',true);assert.equal(sandbox.state.ready.length,9);
  await context.loadDemo('ambient',true);assert.equal(sandbox.state.ready.length,19);assert.equal(new Set(sandbox.state.ready.map(d=>d.id)).size,19);
  assert.equal(sandbox.state.loadingDemo,false);
  console.log('PASS: 18 finite, audible stereo textures and 8 bounded brass phrases with faded edges; pack append preserves collection, prevents duplicates, and keeps unique IDs');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
