const {test}=require('node:test');
const assert=require('node:assert/strict');
require('./tests/fixtures/actions.js');require('./tests/fixtures/defaults.js');
const M=require('./model.js'),L=require('./layers.js');
const fresh=()=>{const d=M.clone(DEFAULT_UI);d.screens.Auth.rows=['One','Two','Three'].map(text=>({type:'text',text,color:'#FFFFFFFF'}));return d;};

test('renaming and hiding a layer round trip through the actual document interface',()=>{
  const d=fresh(),s=d.screens.Auth;L.metadata(s,[1],'name','Subtitle');L.metadata(s,[1],'hidden',true);M.validate(d);
  assert.equal(s.rows[1].name,'Subtitle');assert.equal(M.resolve(s).length,2);
  assert.equal(M.plan(s).shapes.some(shape=>shape.text==='Two'),false);
  L.metadata(s,[1],'hidden',false);assert.equal(M.resolve(s).length,3);
});
test('groups preserve order and can be ungrouped without changing their children',()=>{
  const d=fresh(),s=d.screens.Auth,children=M.clone(s.rows);
  const path=L.group(s,[[0],[2]]);M.validate(d);
  assert.deepEqual(path,[0]);assert.deepEqual(s.rows[0].rows.map(r=>r.text),['One','Three']);
  L.ungroup(s,path);assert.deepEqual(s.rows.map(r=>r.text),['One','Three','Two']);
  assert.deepEqual(s.rows[0],children[0]);
});
test('lock is inherited and prevents moving or grouping descendants',()=>{
  const d=fresh(),s=d.screens.Auth,path=L.group(s,[[0],[1]]);L.metadata(s,path,'locked',true);M.validate(d);
  assert.equal(L.state(s,[0,'rows',1]).locked,true);
  assert.throws(()=>L.move(s,[0,'rows',1],[1]),/Unlock/);
  assert.throws(()=>L.group(s,[[0,'rows',0]]),/Unlock/);
  assert.equal(M.plan(s).shapes.some(shape=>shape.text==='One'),true);
});
test('reorder can move across groups while rejecting self containment',()=>{
  const d=fresh(),s=d.screens.Auth;L.group(s,[[1],[2]]);
  assert.deepEqual(L.move(s,[0],[1],true),[0,'rows',2]);M.validate(d);
  assert.deepEqual(s.rows[0].rows.map(r=>r.text),['Two','Three','One']);
  assert.throws(()=>L.move(s,[0],[0,'rows',1],true),/itself/);
});
test('button hiding removes the control rather than making an invisible click target',()=>{
  const d=fresh(),s=d.screens.Auth;s.rows=[{type:'buttons',buttons:[{label:'A',action:'Password'},{label:'B',action:'Submit'}]}];
  L.metadata(s,[0,'buttons',0],'hidden',true);M.validate(d);
  assert.deepEqual(M.resolve(s)[0].buttons.map(b=>b.action),['Submit']);
  assert.equal(M.plan(s).hits.filter(h=>h.button).length,1);
});
test('hidden live overrides retain stable slot numbering and real actions',()=>{
  const d=fresh(),s=d.screens.Auth;s.rows=[{type:'binding',key:'choices',controls:[{label:'{label}',action:'Quit',slot:0,hidden:true},{label:'Styled {label}',action:'Quit',slot:1}]}];
  s.samples.choices=[{type:'buttons',buttons:[{label:'A',action:'Password'},{label:'B',action:'Submit'}]}];M.validate(d);
  const bs=M.resolve(s)[0].buttons;assert.equal(bs.length,1);assert.equal(bs[0].label,'Styled B');assert.equal(bs[0].action,'Submit');
});
test('editor rejects malformed metadata and unsafe button/row moves',()=>{
  for(const [key,value] of [['name','a'.repeat(129)],['locked','true'],['hidden',1]]){const d=fresh();L.metadata(d.screens.Auth,[0],key,value);assert.throws(()=>M.validate(d));}
  const d=fresh(),s=d.screens.Auth;s.rows.push({type:'buttons',buttons:[{label:'B',action:'Submit'}]});
  assert.throws(()=>L.move(s,[0],[3,'buttons',0]),/buttons/);
});
test('move up/down acts on a standalone button and disables at real boundaries',()=>{
  const d=fresh(),s=d.screens.Auth;s.rows.splice(1,0,{type:'buttons',buttons:[{label:'Go',action:'Submit'}]});
  let path=[1,'buttons',0];path=L.step(s,path,-1);assert.deepEqual(path,[0,'buttons',0]);assert.equal(s.rows[0].buttons[0].label,'Go');
  assert.equal(L.stepTarget(s,path,-1),null);path=L.step(s,path,1);assert.deepEqual(path,[1,'buttons',0]);M.validate(d);
});
test('duplicate creates a real standalone button and deletion prunes empty wrappers',()=>{
  const d=fresh(),s=d.screens.Auth;s.rows=[{type:'transform',x:2,y:0,scale_x:1,scale_y:1,rows:[{type:'buttons',buttons:[{label:'Go',action:'Submit'}]}]}];
  const copies=L.duplicateAll(s,[[0,'rows',0,'buttons',0]]);assert.deepEqual(copies,[[1,'rows',0,'buttons',0]]);assert.equal(M.plan(s).hits.filter(h=>h.button).length,2);
  L.remove(s,copies);assert.equal(s.rows.length,1);L.remove(s,[[0,'rows',0,'buttons',0]]);assert.equal(s.rows.length,0);M.validate(d);
});
test('delete hides a live control, duplicate creates a usable button, live order is explicit',()=>{
  const d=fresh(),s=d.screens.Auth;s.rows=[{type:'binding',key:'choices',controls:[{label:'{label}',action:'Password',slot:0}]}];s.samples.choices=[{type:'buttons',buttons:[{label:'Edit password',action:'Password'},{label:'Continue',action:'Submit'}]}];
  assert.equal(L.stepTarget(s,[0,'controls',0],1),null);
  const copy=L.duplicate(s,[0,'controls',0]);assert.deepEqual(copy,[1,'buttons',0]);assert.deepEqual(L.get(s,copy).on_click,{kind:'binding',key:'choices',slot:0});
  assert.equal(M.resolve(s)[1].buttons[0].enabled,true);
  L.remove(s,[[0,'controls',0]]);M.validate(d);assert.equal(M.resolve(s)[0].buttons[0].label,'Continue');assert.equal(s.rows[0].controls[0].hidden,true);
});
test('dragging standalone buttons reorders visible layers without leaving empty flow containers',()=>{
  const d=fresh(),s=d.screens.Auth;s.rows=[{type:'buttons',buttons:[{label:'One',action:'Password'}]},{type:'text',text:'Middle',color:'#FFFFFFFF'},{type:'buttons',buttons:[{label:'Two',action:'Submit'}]}];
  const path=L.move(s,[0,'buttons',0],[2,'buttons',0]);M.validate(d);assert.deepEqual(path,[1,'buttons',0]);assert.equal(s.rows[0].text,'Middle');assert.equal(L.get(s,path).label,'One');
});
