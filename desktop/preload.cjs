const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('soundCrateDesktop',{
  prepare:(id,name,bytes)=>ipcRenderer.invoke('prepare-stem',{id,name,bytes}),
  drag:ids=>ipcRenderer.send('drag-stems',ids)
});
