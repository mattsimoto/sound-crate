// Exercises real app wiring and project/session persistence with a simulated audio graph.
// Listening quality and native DAW drops require a Mac.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom'),{indexedDB}=require('fake-indexeddb');
class AudioBufferMock{
  constructor({numberOfChannels,length,sampleRate}){
    this.numberOfChannels=numberOfChannels;this.length=length;this.sampleRate=sampleRate;this.duration=length/sampleRate;
    this.data=Array.from({length:numberOfChannels},()=>new Float32Array(length));
  }
  getChannelData(c){return this.data[c];}
  copyToChannel(data,c){this.data[c].set(data);}
}
const param=()=>({value:0,setTargetAtTime(){},setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}});
const node=()=>({connect(){},disconnect(){},start(){},stop(){},gain:param(),pan:param(),frequency:param(),
  threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(),detune:param(),Q:param()});
class AudioContextMock{
  constructor(){this.sampleRate=8000;this.currentTime=0;this.state='running';this.destination=node();}
  createBuffer(channels,length,sampleRate){return new AudioBufferMock({numberOfChannels:channels,length,sampleRate});}
  createGain(){return node();}createBiquadFilter(){return node();}createDynamicsCompressor(){return node();}
  createStereoPanner(){return node();}createBufferSource(){return node();}createOscillator(){return node();}
}
class OfflineMock extends AudioContextMock{
  constructor(channels,length,sampleRate){super();this.result=this.createBuffer(channels,length,sampleRate);}
  async startRendering(){return this.result;}
}
async function run(){
  const errors=[], html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const dom=new JSDOM(html,{url:'https://sound-crate.test',runScripts:'dangerously',beforeParse(w){
    w.AudioContext=AudioContextMock;w.OfflineAudioContext=OfflineMock;w.AudioBuffer=AudioBufferMock;
    w.Blob=Blob;w.indexedDB=indexedDB;w.requestAnimationFrame=()=>0;
    w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
    w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
    w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
    w.addEventListener('error',event=>errors.push(event.error));
  }});
  const w=dom.window,evalApp=code=>w.eval(code);
  assert.equal(w.document.querySelectorAll('.slot').length,6);
  evalApp(`
    audio(); openCrate();
    const testBuffer=ctx.createBuffer(2,38400,8000);
    for(let c=0;c<2;c++) for(let i=0;i<testBuffer.length;i++) testBuffer.getChannelData(c)[i]=Math.sin(i/12)*0.2;
    const testItem={id:'test',name:'Bass test 100bpm Am',buf:testBuffer,favorite:true,
      a:{ok:true,bpm:100,tonic:9,minor:true,pitched:true,role:'bass',firstOnset:0}};
    state.ready=[testItem]; state.total=1; state.checked=1; state.started=true;
    slots[0].item=testItem; slots[0].buffer=testBuffer; slots[0].part=0; slots[0].semis=0; slots[0].usedBeats=8;
    slots[0].mute=true; slots[0].lock=true; slots[0].vol=0.3; slots[0].panV=-0.5;
    state.hype=true; updateSlotUI(slots[0]);
  `);
  const blob=await evalApp('saveProject(false)'),original=JSON.parse(await blob.text());
  assert.equal(original.version,2);assert.equal(original.sounds.length,1);
  assert.equal(await w.openProject(blob),true);
  assert.equal(evalApp('slots[0].mute'),true);assert.equal(evalApp('slots[0].lock'),true);
  assert.equal(evalApp('slots[0].vol'),0.3);assert.equal(evalApp('state.hype'),true);
  assert.equal(evalApp('slots[0].buffer.getChannelData(0)[200]'),evalApp('slots[0].item.buf.getChannelData(0)[200]'));
  // Invalid files must leave the working mix intact.
  const bad=structuredClone(original);bad.slots[0].steps=[true];
  assert.equal(await w.openProject(new Blob([JSON.stringify(bad)])),undefined);
  assert.equal(evalApp('slots[0].vol'),0.3);
  // Version 1 project files remain readable.
  const legacy=structuredClone(original);legacy.version=1;
  delete legacy.settings.safety;delete legacy.settings.hype;
  legacy.slots.forEach(s=>{delete s.role;delete s.steps;delete s.gainDB;delete s.octave;delete s.timeFactor;delete s.repeat4;});
  assert.equal(await w.openProject(new Blob([JSON.stringify(legacy)])),true);
  w.document.querySelector('#addSlot').click();
  await new Promise(resolve=>setTimeout(resolve,100));
  assert.equal(evalApp('slots.length'),7);
  assert.equal(await w.openProject(await evalApp('saveProject(false)')),true);
  assert.equal(evalApp('slots.length'),7);
  w.document.querySelector('#undoBtn').click(); // Opening a project clears history.
  evalApp('remember(); slots[0].vol=0.1; travel(past,future)');
  assert.equal(evalApp('slots[0].vol'),0.3);
  evalApp('travel(future,past)');assert.equal(evalApp('slots[0].vol'),0.1);
  // Slot adjustments affect rendered loop length and survive reopening.
  evalApp('slots[0].lock=false; slots[0].repeat4=true; slots[0].steps[0]=false; slots[0].octave=12; slots[0].gainDB=3');
  await evalApp('renderSlot(slots[0])');
  assert.equal(evalApp('slots[0].buffer.length'),76800);
  assert.equal(await w.openProject(await evalApp('saveProject(false)')),true);
  assert.equal(evalApp('slots[0].repeat4'),true);assert.equal(evalApp('slots[0].gainDB'),3);
  // Named session storage persists the actual project blob.
  const stored=await evalApp('saveProject(false)');
  await w.sessionStore('readwrite',store=>store.put({id:'test-session',name:'My beat',time:1,blob:stored}));
  const sessions=await w.sessionStore('readonly',store=>store.getAll());
  assert.equal(sessions[0].name,'My beat');assert.equal(await w.openProject(sessions[0].blob),true);
  await w.sessionStore('readwrite',store=>store.delete('test-session'));
  assert.equal((await w.sessionStore('readonly',store=>store.getAll())).length,0);
  // Export files share the selected bar count; WAV headers match their byte count.
  const downloads=[];w.download=(blob,name)=>downloads.push({blob,name});
  w.document.querySelector('#exportBars').value='4';
  await w.saveMix();
  w.document.querySelector('#stemMode').value='mixed';
  evalApp('slots.forEach(s=>{s.mute=false;s.solo=false})');
  await w.saveStems();
  assert.equal(downloads.length,3); // One mix and two occupied slots.
  for(const exported of downloads){
    const bytes=await exported.blob.arrayBuffer(),header=new DataView(bytes);
    assert.equal(header.getUint32(24,true),8000);
    assert.equal(header.getUint32(40,true),76800*4);
    assert.equal(bytes.byteLength,44+76800*4);
  }
  assert.deepEqual(errors,[]);
  dom.window.close();
  console.log('PASS: UI initialization, project v1/v2 reopening, invalid-file isolation, dynamic slots, undo/redo, adjustments, named session storage, aligned WAV exports');
}
run().catch(err=>{console.error(err);process.exitCode=1;});
