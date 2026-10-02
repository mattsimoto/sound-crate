const {app,BrowserWindow,ipcMain,nativeImage}=require('electron');
const path=require('node:path'),fs=require('node:fs'),{pathToFileURL}=require('node:url');
const {writeStem}=require('./stem-files.cjs');
let win,stemDirectory;
const stems=new Map();
const page=path.join(__dirname,'../index.html'),pageURL=pathToFileURL(page).href;
function trusted(event){return win && event.sender===win.webContents && event.senderFrame?.url===pageURL;}
function createWindow(){
  win=new BrowserWindow({width:1280,height:900,title:'Sound Crate',
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(event,url)=>{if(url!==pageURL) event.preventDefault();});
  win.loadFile(page);
}
ipcMain.handle('prepare-stem',(event,value)=>{
  if(!trusted(event)) throw new Error('Invalid sender');
  const file=writeStem(stemDirectory,value),old=stems.get(value.id);
  if(old && old!==file){try{fs.unlinkSync(old);}catch{}}
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
  stemDirectory=fs.mkdtempSync(path.join(app.getPath('temp'),'sound-crate-stems-'));
  createWindow();
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0) createWindow();});
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin') app.quit();});
app.on('will-quit',()=>{if(stemDirectory) fs.rmSync(stemDirectory,{recursive:true,force:true});});
