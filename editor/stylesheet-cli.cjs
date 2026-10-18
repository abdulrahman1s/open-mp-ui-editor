/* Build/editor tooling only. Native gameplay continues to consume validated JSON. */
const fs=require('node:fs'),path=require('node:path');
require('./actions.js');require('./model.js');
const S=require('./stylesheet.js');
const root=path.resolve(__dirname,'../..');
function write(file,data){
  if(fs.existsSync(file)&&fs.readFileSync(file,'utf8')===data)return;
  fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp-'+process.pid;
  try{fs.writeFileSync(tmp,data);fs.renameSync(tmp,file);}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}
}
try{
  const mode=process.argv[2];
  if(mode==='encode'){const doc=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(S.stringify(doc));}
  else if(mode==='decode'){const {source,samples}=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(JSON.stringify(S.parse(source,samples)));}
  else if(mode==='compile'){
    const base=process.argv[3]?path.resolve(process.argv[3]):root,css=path.join(base,'assets/ui.css'),preview=path.join(base,'assets/ui.preview.json'),json=path.join(base,'assets/ui.json');
    if(!fs.existsSync(css))throw Error('Missing assets/ui.css. Import the existing document before compiling.');
    const samples=fs.existsSync(preview)?JSON.parse(fs.readFileSync(preview,'utf8')):{};
    const doc=S.parse(fs.readFileSync(css,'utf8'),samples);write(json,JSON.stringify(doc,null,2)+'\n');
  }else if(mode==='migrate'){
    const css=path.join(root,'assets/ui.css'),preview=path.join(root,'assets/ui.preview.json');
    if(fs.existsSync(css))throw Error('ui.css already exists; migration would overwrite it.');
    const doc=JSON.parse(fs.readFileSync(path.join(root,'assets/ui.json'),'utf8')),source=S.stringify(doc);S.parse(source,S.samples(doc));
    write(preview,JSON.stringify(S.samples(doc),null,2)+'\n');write(css,source);
  }else throw Error('Use encode, decode, compile [project-root], or migrate.');
}catch(error){process.stderr.write(error.message+'\n');process.exitCode=1;}
