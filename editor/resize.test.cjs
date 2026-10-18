const { test } = require('node:test');
const assert = require('node:assert/strict');
require('./tests/fixtures/actions.js'); require('./tests/fixtures/defaults.js');
const M = require('./model.js');
const R = require('./resize.js');
const fresh = () => M.clone(DEFAULT_UI);
const caption = (p, name) => p.shapes.find(s => s.kind === 'text' && s.text === name);

test('container resize changes button dimensions while preserving glyph dimensions', () => {
  const d = fresh(), s = d.screens.Auth;
  s.rows = [{ type:'buttons', buttons:[{label:'Continue',action:'Submit',style:{padding_x:6,padding_y:2}}] }];
  const before = M.plan(s), hit = before.hits.find(h=>h.button), text = caption(before,'Continue');
  const edit = R.begin(s,hit.path,before);
  assert.equal(edit.axes,'xy'); edit.apply({width:160,height:28});
  M.validate(d);
  const after=M.plan(s), resized=after.hits.find(h=>h.button), actual=caption(after,'Continue');
  assert.deepEqual([resized.w,resized.h],[160,28]);
  assert.deepEqual([actual.sx,actual.sy,actual.x,actual.y],[text.sx,text.sy,text.x,text.y]);
  assert.equal(s.rows[0].buttons[0].style.scale_x,undefined);
});

test('panel resize changes content width and wrapping without scaling fonts', () => {
  const d=fresh(),s=d.screens.Auth,before=M.plan(s),scale=s.scale;
  const edit=R.begin(s,null,before); assert.equal(edit.axes,'x');
  edit.apply({width:300});M.validate(d);
  assert.equal(M.plan(s).width,300);assert.equal(s.scale,scale);
  const fonts=p=>[...new Set(p.shapes.filter(s=>s.kind==='text').map(s=>`${s.sx},${s.sy}`))];
  assert.deepEqual(fonts(M.plan(s)),fonts(before));
});

test('west/north resize respects nested and existing button scales', () => {
  const d=fresh(),s=d.screens.Auth;s.scale=1.2;
  s.rows=[{type:'transform',x:0,y:0,scale_x:1.5,scale_y:1.1,rows:[{type:'buttons',buttons:[{label:'A',action:'Submit',width:60,style:{scale_x:.8,scale_y:1.2}}]}]}];
  const before=M.plan(s),hit=before.hits.find(h=>h.button),edit=R.begin(s,hit.path,before);
  edit.apply({width:hit.w+12,height:hit.h+5,west:true,north:true});M.validate(d);
  const after=M.plan(s).hits.find(h=>h.button);
  assert.ok(Math.abs(after.x+after.w-hit.x-hit.w)<1e-8);
  assert.ok(Math.abs(after.y+after.h-hit.y-hit.h)<1e-8);
  assert.equal(s.rows[0].rows[0].buttons[0].style.scale_x,.8);
});

test('resizing sprites and text preserves wrapper scale and glyph size', () => {
  const d=fresh(),s=d.screens.Auth;
  s.rows=[{type:'transform',x:2,y:3,scale_x:2,scale_y:1,rows:[{type:'sprite',texture:'LD_SPAC:white',width:40,height:20,color:'#FFFFFFFF'}]}];
  let p=M.plan(s);R.begin(s,[0],p).apply({width:100,height:30});M.validate(d);
  assert.deepEqual([s.rows[0].rows[0].width,s.rows[0].rows[0].height,s.rows[0].scale_x],[50,30,2]);
  s.rows=[{type:'text',text:'Hello',color:'#FFFFFFFF'}];p=M.plan(s);
  const text=caption(p,'Hello'),edit=R.begin(s,[0],p);assert.equal(edit.axes,'x');edit.apply({width:60});M.validate(d);
  const after=M.plan(s);assert.equal(after.hits.find(h=>JSON.stringify(h.path)==='[0]').w,60);
  assert.deepEqual([caption(after,'Hello').sx,caption(after,'Hello').sy],[text.sx,text.sy]);
});

test('live text width rewraps without changing fonts; west anchor and repeated frames are stable',()=>{
  const d=fresh(),s=d.screens.Auth;s.rows=[{type:'transform',x:4,y:3,scale_x:1.5,scale_y:1.2,rows:[{type:'binding',key:'heading'}]}];
  s.samples={heading:[{type:'text',text:'A much longer live sentence that needs more than one line',color:'#FFFFFFFF'}]};
  const p=M.plan(s),hit=p.hits.find(h=>JSON.stringify(h.path)==='[0]'),edit=R.begin(s,[0],p),font=p.shapes.find(s=>s.text?.startsWith('A much'));
  edit.apply({width:90,west:true});const value=JSON.stringify(s);edit.apply({width:90,west:true});assert.equal(JSON.stringify(s),value);M.validate(d);
  const after=M.plan(s),resized=after.hits.find(h=>JSON.stringify(h.path)==='[0]'),text=after.shapes.find(s=>s.text?.startsWith('A'));
  assert.equal(resized.w,90);assert.ok(resized.h>hit.h);assert.ok(Math.abs(resized.x+resized.w-hit.x-hit.w)<1e-8);
  assert.deepEqual([text.sx,text.sy],[font.sx,font.sy]);
});

test('button resizing clamps below padding and remains stable across repeated pointer frames', () => {
  const d=fresh(),s=d.screens.Auth;s.rows=[{type:'buttons',buttons:[{label:'A',action:'Submit',style:{padding_x:8,padding_y:4}}]}];
  const p=M.plan(s),edit=R.begin(s,[0,'buttons',0],p);
  edit.apply({width:0,height:-20});M.validate(d);
  assert.deepEqual([s.rows[0].buttons[0].width,s.rows[0].buttons[0].style.height],[17,9]);
  edit.apply({width:180,height:30,west:true});const x=M.buttonPosition(s.rows[0].buttons[0]).x;
  edit.apply({width:180,height:30,west:true});assert.equal(M.buttonPosition(s.rows[0].buttons[0]).x,x);
});

test('resizing from west/north moves only the active state position',()=>{
  const d=fresh(),s=d.screens.Auth,b={label:'Go',action:'Submit',width:80,style:{x:3,y:4}};
  s.rows=[{type:'buttons',buttons:[b]}];s.samples._variables={'ui.state':'Register'};
  const p=M.plan(s),hit=p.hits.find(h=>h.button);
  R.begin(s,hit.path,p,'Register').apply({width:100,height:20,west:true,north:true});
  assert.deepEqual(M.buttonPosition(b,'default'),{x:3,y:4});
  assert.deepEqual(M.buttonPosition(b,'Register'),{x:-17,y:0});M.validate(d);
});

test('asking which handles are available never mutates the document',()=>{
  const d=fresh(),s=d.screens.Auth,before=JSON.stringify(d),p=M.plan(s);
  for(const hit of p.hits)R.begin(s,hit.path,p);
  assert.equal(JSON.stringify(d),before);
});
test('nested sprites and button row selection respect their actual content width',()=>{
  const d=fresh(),s=d.screens.Auth;s.rows=[{type:'transform',width:100,x:0,y:0,scale_x:1,scale_y:1,rows:[{type:'sprite',texture:'LD_SPAC:white',width:40,height:20,color:'#FFFFFFFF'}]}];
  let p=M.plan(s);R.begin(s,[0],p).apply({width:200});M.validate(d);assert.equal(s.rows[0].rows[0].width,100);
  s.rows=[{type:'buttons',buttons:[{label:'A',action:'Submit'}]}];p=M.plan(s);R.begin(s,[0],p).apply({width:70});M.validate(d);
  assert.equal(M.plan(s).hits.find(h=>JSON.stringify(h.path)==='[0]').w,70);
});
test('the left handle resizes a horizontal group while keeping its right edge fixed',()=>{
  const d=fresh(),s=d.screens.Auth;s.rows=[{type:'buttons',width:68.4,buttons:[{label:'Equip',action:'Submit'}]}];
  let p=M.plan(s),hit=p.hits.find(h=>JSON.stringify(h.path)==='[0]'),edit=R.begin(s,[0],p);
  edit.apply({width:45,west:true});M.validate(d);let after=M.plan(s).hits.find(h=>JSON.stringify(h.path)==='[0]');
  assert.ok(Math.abs(after.w-45)<1e-8);assert.ok(Math.abs(after.x+after.w-hit.x-hit.w)<1e-8);
  p=M.plan(s);hit=p.hits.find(h=>JSON.stringify(h.path)==='[0]');R.begin(s,[0],p).apply({width:80,west:true});M.validate(d);after=M.plan(s).hits.find(h=>JSON.stringify(h.path)==='[0]');
  assert.ok(Math.abs(after.w-80)<1e-8);assert.ok(Math.abs(after.x+after.w-hit.x-hit.w)<1e-8);
});
