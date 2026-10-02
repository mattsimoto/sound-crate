// Runs the real renderer and MediaRecorder with Chromium's synthetic microphone.
const {app,BrowserWindow}=require('electron');
const path=require('node:path');
app.commandLine.appendSwitch('use-fake-device-for-media-stream');
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
const timeout=setTimeout(()=>{console.error('Recording smoke test timed out');app.exit(1);},60000);
app.whenReady().then(async()=>{
  const win=new BrowserWindow({show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.webContents.session.webRequest.onBeforeRequest({urls:['https://*/*']},(_details,callback)=>callback({cancel:true}));
  try{
    await win.loadFile(path.join(__dirname,'../index.html'));
    const result=await win.webContents.executeJavaScript(`
      (async()=>{
        await showRecorder();
        await beginRecording();
        if(mic.phase!=='recording') throw new Error($('#recordStatus').textContent);
        await new Promise(resolve=>setTimeout(resolve,1200));
        stopRecording();
        for(let i=0;i<100 && mic.phase!=='recorded';i++) await new Promise(resolve=>setTimeout(resolve,50));
        if(mic.phase!=='recorded') throw new Error($('#recordStatus').textContent);
        const duration=mic.buffer.duration, wavBytes=mic.wav.size;
        $('#recordName').value='Synthetic microphone';
        $('#recordRole').value='drums';
        await addRecordedSound();
        const added=state.ready.find(it=>it.name==='Synthetic microphone');
        if(!added || !slots.some(s=>s.item===added && s.buffer)) throw new Error('Recording was not fitted into a slot');
        const project=await saveProject(false);
        if(!project || project.size<44) throw new Error('Recorded sound was not saved in project');
        if(mic.stream!==null) throw new Error('Microphone remained active');
        return {duration,wavBytes,projectBytes:project.size};
      })()
    `,true);
    if(result.duration<0.1 || result.wavBytes<=44) throw new Error('Empty microphone recording');
    console.log('PASS: real MediaRecorder capture, decode, WAV creation, slot fitting, project save, stream release',result);
    clearTimeout(timeout);app.exit(0);
  }catch(error){console.error(error);clearTimeout(timeout);app.exit(1);}
}).catch(error=>{console.error(error);app.exit(1);});
