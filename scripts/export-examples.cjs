const fs=require('node:fs'),path=require('node:path'),root=path.join(__dirname,'..');
require('../editor/public-preview.js');require('../editor/defaults.js');require('../editor/sprites.js');require('../editor/model.js');
const E=require('../editor/shared-export.js');
const dir=path.join(root,'artifacts/exported');fs.mkdirSync(dir,{recursive:true});
for(const name of Object.keys(DEFAULT_UI.screens))fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify(E.exportScreen(DEFAULT_UI,name).definition,null,2)+'\n');
console.log('Exported '+Object.keys(DEFAULT_UI.screens).length+' public screens through the browser export module.');
