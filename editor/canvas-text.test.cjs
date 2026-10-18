const {test}=require('node:test'),assert=require('node:assert/strict');
require('./tests/fixtures/actions.js');require('./tests/fixtures/defaults.js');require('./tests/fixtures/variables.js');const M=require('./model.js'),T=require('./canvas-text.js');
test('canvas text targets preserve live templates until an explicit apply',()=>{
  const s=M.clone(DEFAULT_UI.screens.Auth);s.rows=[{type:'transform',x:0,y:0,scale_x:1,scale_y:1,rows:[{type:'text',text:'Hello {{player.name}}',color:'#FFFFFFFF'}]}];
  const before=JSON.stringify(s),edit=T.begin(s,[0]);assert.equal(edit.value,'Hello {{player.name}}');assert.equal(edit.multiline,true);assert.equal(JSON.stringify(s),before);
  assert.equal(edit.apply(edit.value),false);assert.equal(edit.apply('Welcome {{player.name}}'),true);assert.equal(s.rows[0].rows[0].text,'Welcome {{player.name}}');
});
test('button editing uses meaningful dynamic values and body bindings use named templates',()=>{
  const s=M.clone(DEFAULT_UI.screens.Auth);s.rows=[{type:'buttons',buttons:[{label:'{label}',action:'Remember'}]},{type:'binding',key:'account'}];
  const button=T.begin(s,[0,'buttons',0],{name:'Auth'});assert.equal(button.value,'Remember me: {{account.remember_status}}');assert.equal(button.multiline,false);
  button.apply('Keep login: {{account.remember_status}}');assert.equal(s.rows[0].buttons[0].label,'Keep login: {{account.remember_status}}');
  const edit=T.begin(s,[1],{defaults:DEFAULT_UI.screens.Auth});assert.equal(edit.value,'Account: {{player.name}}');
  assert.throws(()=>edit.apply('a'.repeat(2049)),/too long/);assert.equal(s.rows[1].text,undefined);
});
test('titles are editable and graphic layers do not expose fake text',()=>{
  const s=M.clone(DEFAULT_UI.screens.Auth),edit=T.begin(s,null);edit.apply('Welcome {{player.name}}');assert.equal(s.title,'Welcome {{player.name}}');
  s.rows=[{type:'sprite',texture:'LD_SPAC:white',width:20,height:20,color:'#FFFFFFFF'}];assert.equal(T.begin(s,[0]),null);assert.equal(T.begin(undefined,[0]),null);
});
test('live button caption values are scoped to each offered control',()=>{
  const s=M.clone(DEFAULT_UI.screens.Auth);s.rows=[{type:'buttons',buttons:[{label:'Prefix {{button.caption}}',action:'Password'},{label:'{{button.caption}}',action:'Remember'}]}];
  s.samples._labels={Password:'Enter password',Remember:'Remember me: On'};
  assert.deepEqual(M.resolve(s)[0].buttons.map(b=>b.label),['Prefix Enter password','Remember me: On']);
});
