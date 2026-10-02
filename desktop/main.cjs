const {app,BrowserWindow,ipcMain,nativeImage,systemPreferences}=require('electron');
const path=require('node:path'),fs=require('node:fs'),{pathToFileURL}=require('node:url');
const {validateStem,writeStem}=require('./stem-files.cjs');
let win,stemDirectory;
const stems=new Map();
const page=path.join(__dirname,'../index.html'),pageURL=pathToFileURL(page).href;
function trusted(event){return win && event.sender===win.webContents && event.senderFrame?.url===pageURL;}
function createWindow(){
  win=new BrowserWindow({width:1280,height:900,title:'Sound Crate',
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.session.setPermissionCheckHandler((contents,permission,origin,details)=>{
    return contents===win.webContents && contents.getURL()===pageURL &&
      permission==='media' && details.mediaType==='audio';
  });
  win.webContents.session.setPermissionRequestHandler((contents,permission,callback,details)=>{
    const audioOnly=permission==='media' && details.mediaTypes?.length>0 && details.mediaTypes.every(type=>type==='audio');
    callback(contents===win.webContents && contents.getURL()===pageURL && audioOnly);
  });
  win.webContents.on('will-navigate',(event,url)=>{if(url!==pageURL) event.preventDefault();});
  win.loadFile(page);
}
ipcMain.handle('microphone-permission',async event=>{
  if(!trusted(event)) return false;
  return process.platform==='darwin'?systemPreferences.askForMediaAccess('microphone'):true;
});
ipcMain.handle('prepare-stem',(event,value)=>{
  if(!trusted(event)) throw new Error('Invalid sender');
  validateStem(value);
  const directory=fs.mkdtempSync(path.join(stemDirectory,'stem-'));
  const file=writeStem(directory,value);
  // Keep previous exports: a DAW may reference imported files without copying them.
  stems.set(value.id,file);
  return true;
});
ipcMain.on('drag-stems',(event,ids)=>{
  if(!trusted(event) || !Array.isArray(ids) || ids.length<1 || ids.length>12 ||
    ids.some(id=>typeof id!=='string' || !stems.has(id))) return;
  const files=ids.map(id=>stems.get(id));
  // A locally generated image avoids network access during a drag gesture.
  const pixels=Buffer.alloc(32*32*4);
  for(let i=0;i<pixels.length;i+=4){pixels[i]=74;pixels[i+1]=107;pixels[i+2]=255;pixels[i+3]=255;}
  const icon=nativeImage.createFromBitmap(pixels,{width:32,height:32});
  try{event.sender.startDrag({file:files[0],files,icon});}catch(err){console.error('Native drag failed:',err.message);}
});
app.whenReady().then(()=>{
  const exportRoot=path.join(app.getPath('userData'),'DAW Stems');
  fs.mkdirSync(exportRoot,{recursive:true});
  stemDirectory=fs.mkdtempSync(path.join(exportRoot,'session-'));
  createWindow();
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0) createWindow();});
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin') app.quit();});
