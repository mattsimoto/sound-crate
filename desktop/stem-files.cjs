const fs=require('node:fs'),path=require('node:path');
function validateStem(value){
  if(!value || typeof value.id!=='string' || !/^\d{1,8}$/.test(value.id) ||
    typeof value.name!=='string' || !value.name.endsWith('.wav') ||
    !(value.bytes instanceof ArrayBuffer) || value.bytes.byteLength<44 || value.bytes.byteLength>100*1024*1024)
    throw new Error('Invalid stem');
  const bytes=Buffer.from(value.bytes);
  if(bytes.toString('ascii',0,4)!=='RIFF' || bytes.toString('ascii',8,12)!=='WAVE') throw new Error('Expected WAV audio');
  return {id:value.id,name:value.name.replace(/[^a-zA-Z0-9_.-]/g,'-').slice(0,150),bytes};
}
function writeStem(directory,value){
  const stem=validateStem(value),file=path.join(directory,stem.id+'-'+stem.name);
  fs.writeFileSync(file,stem.bytes);
  return file;
}
module.exports={validateStem,writeStem};
