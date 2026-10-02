const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {validateStem,writeStem}=require('../desktop/stem-files.cjs');
const bytes=new ArrayBuffer(48),buffer=Buffer.from(bytes);
buffer.write('RIFF',0);buffer.write('WAVE',8);
const stem={id:'1',name:'../../bass.wav',bytes};
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sound-crate-test-'));
try{
  const file=writeStem(directory,stem);
  assert.equal(path.dirname(file),directory); assert.deepEqual(fs.readFileSync(file),buffer);
  assert.throws(()=>validateStem({...stem,id:'../escape'}));
  assert.throws(()=>validateStem({...stem,bytes:new ArrayBuffer(44)}));
  assert.throws(()=>validateStem({...stem,name:'script.js'}));
  console.log('PASS: native stem file creation, filename sanitizing, invalid payload rejection');
}finally{fs.rmSync(directory,{recursive:true,force:true});}
