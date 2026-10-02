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
  createMediaStreamSource(){return node();}
  createAnalyser(){return {...node(),fftSize:256,getFloatTimeDomainData:array=>array.fill(0.2)};}
}
class OfflineMock extends AudioContextMock{
  constructor(channels,length,sampleRate){super();this.result=this.createBuffer(channels,length,sampleRate);}
  async startRendering(){return this.result;}
}
async function run(){
  const errors=[],micRequests=[],tracks=[], html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  let denyMic=false,pendingMic=null;
  const dom=new JSDOM(html,{url:'https://sound-crate.test',runScripts:'dangerously',beforeParse(w){
    w.AudioContext=AudioContextMock;w.OfflineAudioContext=OfflineMock;w.AudioBuffer=AudioBufferMock;
    w.Blob=Blob;w.indexedDB=indexedDB;w.requestAnimationFrame=()=>0;
    w.cancelAnimationFrame=()=>{};
    w.HTMLMediaElement.prototype.pause=function(){};
    w.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){},fillRect(){}});
    Object.defineProperty(w.navigator,'mediaDevices',{value:{
      enumerateDevices:async()=>[
        {kind:'audioinput',deviceId:'laptop',label:'Laptop mic'},
        {kind:'audioinput',deviceId:'usb',label:'USB mic'},
        {kind:'videoinput',deviceId:'camera',label:'Camera'}
      ],
      addEventListener(){},
      async getUserMedia(constraints){
        micRequests.push(constraints);
        if(denyMic){const error=new Error('denied');error.name='NotAllowedError';throw error;}
        const track=new w.EventTarget();track.stopped=false;track.stop=()=>{track.stopped=true;};
        tracks.push(track);
        const stream={getTracks:()=>[track],getAudioTracks:()=>[track]};
        if(pendingMic) return new Promise(resolve=>pendingMic.resolve=()=>resolve(stream));
        return stream;
      }
    }});
    w.MediaRecorder=class{
      static isTypeSupported(type){return type==='audio/webm;codecs=opus';}
      constructor(stream,options){this.stream=stream;this.mimeType=options.mimeType;this.state='inactive';}
      start(){this.state='recording';}
      stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['encoded audio'])});this.onstop?.();}
    };
    w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
    w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
    w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
    w.addEventListener('error',event=>errors.push(event.error));
  }});
  const w=dom.window,evalApp=code=>w.eval(code);
  assert.equal(w.document.querySelectorAll('.slot').length,6);
  assert.equal(w.document.querySelector('#crate').hidden,false);
  assert.equal(w.document.querySelector('#padsPanel').hidden,true);
  w.document.querySelector('#padsTab').click();
  assert.equal(w.document.querySelector('#crate').hidden,true);
  assert.equal(w.document.querySelector('#padsPanel').hidden,false);
  w.document.querySelector('#mixerTab').click();
  assert.equal(w.document.querySelector('#playBtn').closest('header')!==null,true);
  assert.equal(w.document.querySelectorAll('.slot-more').length,6);
  w.document.querySelector('#mixName').value='My calm mix';

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
  assert.equal(original.name,'My calm mix');
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
  // Recording uses the explicitly selected USB device and preserves short hits.
  await w.showRecorder();assert.equal(micRequests.length,0);
  assert.equal(w.document.querySelectorAll('#micInput option').length,3);
  w.document.querySelector('#micInput').value='usb';
  evalApp(`ctx.decodeAudioData=async()=>{
    const buffer=ctx.createBuffer(1,1600,8000);buffer.getChannelData(0).fill(0.2);return buffer;
  }`);
  await w.beginRecording();
  assert.equal(micRequests[0].audio.deviceId.exact,'usb');
  assert.equal(micRequests[0].video,false);
  assert.equal(evalApp('mic.phase'),'recording');
  w.stopRecording();
  for(let i=0;i<20 && evalApp('mic.phase')!=='recorded';i++) await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(evalApp('mic.phase'),'recorded');assert.equal(tracks[0].stopped,true);
  w.document.querySelector('#recordName').value='USB clap';
  w.document.querySelector('#recordRole').value='drums';
  await w.addRecordedSound();
  assert.equal(evalApp('state.ready[state.ready.length-1].name'),'USB clap');
  assert.equal(evalApp('state.ready[state.ready.length-1].buf.duration'),0.2);
  assert.equal(evalApp('state.ready[state.ready.length-1].folder'),'Recordings');
  assert.equal(await w.openProject(await evalApp('saveProject(false)')),true);
  assert.equal(evalApp('state.ready.some(it=>it.name==="USB clap")'),true);
  // Denials are actionable and closing an unanswered prompt releases its eventual stream.
  denyMic=true;await w.showRecorder();await w.beginRecording();
  assert.equal(evalApp('mic.phase'),'idle');assert.match(w.document.querySelector('#recordStatus').textContent,/blocked/);
  w.document.querySelector('#recordDialog').close();
  denyMic=false;pendingMic={};await w.showRecorder();
  const pending=w.beginRecording();
  for(let i=0;i<10 && !pendingMic.resolve;i++) await Promise.resolve();
  w.document.querySelector('#recordDialog').close();pendingMic.resolve();await pending;
  assert.equal(tracks[tracks.length-1].stopped,true);
  assert.equal(evalApp('mic.phase'),'idle');
  pendingMic=null;
  // Unexpected device removal finishes a take and releases the microphone.
  await w.showRecorder();await w.beginRecording();
  tracks[tracks.length-1].dispatchEvent(new w.Event('ended'));
  for(let i=0;i<20 && evalApp('mic.phase')!=='recorded';i++) await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(evalApp('mic.phase'),'recorded');
  w.document.querySelector('#recordDialog').close();


  // Independent source correction, pitch and FX survive saving; baked audio is restored exactly.
  evalApp(`slots[0].octave=0;slots[0].fitting={...defaultFitting(),sourceBpm:110,sourceKey:'off',transpose:3,mode:'stretch'};slots[0].effects={...defaultEffects(),echo:.35,reverb:.2};`);
  assert.equal(evalApp('effectiveAnalysis(slots[0]).bpm'),110);
  assert.equal(evalApp('effectiveAnalysis(slots[0]).pitched'),false);
  await evalApp('renderSlot(slots[0])');
  assert.equal(evalApp('slots[0].semis'),3);
  assert.ok(Math.abs(evalApp('slots[0].buffer.duration')-evalApp('(slots[0].repeat4?Math.max(state.bars,4):state.bars)*4*60/state.bpm'))<.001);
  const fxProject=await evalApp('saveProject(false)');
  const fxPacked=JSON.parse(await fxProject.text());
  assert.equal(fxPacked.slots[0].effects.echo,.35);
  assert.equal(await w.openProject(fxProject),true);
  assert.equal(evalApp('slots[0].fitting.sourceBpm'),110);
  assert.equal(evalApp('slots[0].effects.reverb'),.2);
  assert.equal(JSON.parse(await (await evalApp('saveProject(false)')).text()).slots[0].audio.channels[0],fxPacked.slots[0].audio.channels[0]);
  w.adjustSlot(evalApp('slots[0]'));
  const fittingDialog=[...w.document.querySelectorAll('dialog')].find(d=>d.querySelector('.source-bpm'));
  assert.equal(fittingDialog.querySelector('.source-bpm').value,'110');
  assert.equal(fittingDialog.querySelector('.fx-echo').value,'0.35');
  fittingDialog.close();
  // Trim preserves channels and raw data, fades boundaries, and rejects reversed bounds.
  evalApp(`
    const raw=ctx.createBuffer(2,8000,8000);raw.getChannelData(0).fill(.5);raw.getChannelData(1).fill(-.25);
    const edited=editedBuffer(raw,.25,.75,.05,.05);
    if(edited.length!==4000 || edited.getChannelData(0)[0]!==0 || edited.getChannelData(1)[3999]!==0)throw Error('Trim/fade boundaries');
    if(edited.getChannelData(0)[1000]!==.5 || edited.getChannelData(1)[1000]!==-.25 || raw.getChannelData(0)[0]!==.5)throw Error('Stereo or raw preservation');
  `);
  assert.throws(()=>evalApp('editedBuffer(ctx.createBuffer(1,8000,8000),.8,.2,0,0)'));
  // Collection-only recordings and pad choices survive project/recovery restoration.
  evalApp(`
    const extra={...state.ready[0],id:'collection-only',name:'Collection-only take'};
    state.ready.push(extra);padAssignments[0]=extra.id;refreshPads();
  `);
  assert.equal(w.document.querySelectorAll('.sample-pad').length,8);
  await w.triggerPad(0);
  assert.equal(evalApp('padSources.size'),1);
  evalApp('stopPadSources()');assert.equal(evalApp('padSources.size'),0);
  await w.document.querySelector('#recordPads').onclick();
  await w.triggerPad(0);
  assert.equal(evalApp('padEvents.length'),1);
  assert.equal(evalApp('padEvents[0].buffer.numberOfChannels')>=1,true);
  await w.finishPads();assert.equal(evalApp('padRecording'),false);
  assert.equal(w.document.querySelector('#recordPads').disabled,false);
  const withCollection=await evalApp('saveProject(false,true)');
  const packed=JSON.parse(await withCollection.text());
  assert.equal(packed.sounds.some(it=>it.name==='Collection-only take'),true);
  assert.equal(await w.openProject(withCollection),true);
  assert.equal(evalApp('state.ready.find(it=>it.id===padAssignments[0]).name'),'Collection-only take');
  evalApp('recoveryPending=false;recoverySignature=""');await w.saveRecovery();
  const recovery=await evalApp(`sessionStore('readonly',store=>store.get('automatic-recovery'))`);
  assert.ok(recovery.blob);assert.equal(JSON.parse(await recovery.blob.text()).sounds.some(it=>it.name==='Collection-only take'),true);
  await w.checkRecovery();assert.equal(w.document.querySelector('#recoveryBanner').hidden,false);
  await w.document.querySelector('#restoreRecovery').onclick();
  assert.equal(w.document.querySelector('#recoveryBanner').hidden,true);
  assert.equal(evalApp('state.playing'),false);
  assert.deepEqual(errors,[]);
  dom.window.close();
  console.log('PASS: UI, project/session restoration, history, adjustments, aligned exports, USB input selection, short-hit recording, permission denial, cancelled permission cleanup, disconnected microphone');
}
run().catch(err=>{console.error(err);process.exitCode=1;});
