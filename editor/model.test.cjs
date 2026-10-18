const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('./tests/fixtures/actions.js');require('./tests/fixtures/defaults.js');require('./game-fonts.js');require('./sprites.js');require('./webgl.js');
const M = require('./model.js');
const fresh = () => M.clone(DEFAULT_UI);

test('offline document is the actual server source, with every existing screen', () => {
  // Legacy layout fixture protects the inherited editor behaviour.
  M.validate(DEFAULT_UI);
  assert.equal(Object.keys(DEFAULT_UI.screens).length,17);
});
test('all initial states fit the game canvas and widget budget', () => {
  for(const [name,s] of Object.entries(DEFAULT_UI.screens)) {
    const p=M.plan(s);
    assert.ok(p.x>=0 && p.y>=0 && p.x+p.width<=640 && p.y+p.height<=480, name);
    assert.ok(p.height<=390 && p.widgets<=64,name);
  }
});
test('known native layouts keep their footprint and allocation count', () => {
  const a=M.plan(DEFAULT_UI.screens.Auth);assert.deepEqual([a.width,a.height,a.widgets],[244,202,15]);
  const w=M.plan(DEFAULT_UI.screens.Clothing);assert.deepEqual([w.x,w.y,w.width],[430,120,190]);
  const r=M.plan(DEFAULT_UI.screens.Radio);assert.deepEqual([r.x,r.y,r.width,r.widgets],[344,92,276,53]);
});

test('button positions isolate Default and named states, including live binding controls',()=>{
  const d=fresh(),s=d.screens.Auth,b={label:'Continue',action:'Submit',style:{x:4,y:5}};
  s.rows=[{type:'buttons',buttons:[b]}];
  M.setButtonPosition(b,'Register',{x:20});M.setButtonPosition(b,'default',{y:30});
  const read=state=>{s.samples._variables={'ui.state':state};return M.resolve(s)[0].buttons[0].style;};
  assert.deepEqual([read('Register').x,read('Register').y],[20,5]);
  assert.deepEqual([read('default').x,read('default').y],[4,30]);
  assert.deepEqual([read('Working').x,read('Working').y],[4,5]);
  assert.deepEqual(b.style,{x:4,y:5});
  s.rows=[{type:'binding',key:'choices',controls:[{...b,slot:0,action:'Quit',label:'{label}'}]}];
  s.samples.choices=[{type:'buttons',buttons:[{label:'Real',action:'Submit',enabled:false}]}];
  s.samples._variables={'ui.state':'Register'};const resolved=M.resolve(s)[0].buttons[0];
  assert.equal(resolved.style.x,20);assert.equal(resolved.action,'Submit');assert.equal(resolved.enabled,false);
  M.validate(JSON.parse(JSON.stringify(d)));
  s.rows[0].controls[0].positions.Register.x=Infinity;assert.throws(()=>M.validate(d),/state X/);
});

test('radio hearts stay monochrome with one shared hover ring per click target',()=>{
  const s=M.clone(DEFAULT_UI.screens.Radio),p=M.plan(s);
  const hearts=p.shapes.filter(v=>v.texture==='LD_BEAT:cring');
  assert.equal(p.shapes.some(v=>v.texture==='hud:radar_girlfriend'),false);
  assert.ok(hearts.every(v=>v.color==='#FFFFFF00'));
  for(const color of [M.MUTED,M.ACCENT])assert.ok(p.shapes.filter(v=>v.kind==='rect'&&v.color===color&&v.w<10&&v.h<4).length>=6);
  assert.equal(hearts.length,4);
  assert.equal(p.hits.filter(h=>h.button&&h.control?.action?.RadioFavoriteUrl).length,4);
});

test('button click targets resolve live slots, preserve disabled targets and allow no action',()=>{
  const d=fresh(),s=d.screens.Auth;
  s.rows=[{type:'buttons',buttons:[{label:'Run',action:'Password',on_click:{kind:'binding',key:'choices',slot:1}}]}];
  s.samples.choices=[{type:'buttons',buttons:[{label:'One',action:'Password'},{label:'Two',action:'Submit',enabled:false}]}];
  M.validate(d);let b=M.resolve(s)[0].buttons[0];assert.equal(b.action,'Submit');assert.equal(b.enabled,false);
  s.rows[0].buttons[0].on_click={kind:'none'};assert.equal(M.resolve(s)[0].buttons[0].enabled,false);
  s.rows[0].buttons[0].on_click={kind:'binding',key:'choices',slot:64};assert.throws(()=>M.validate(d));
});
test('hidden conditionals collapse, live captions and disabled state survive', () => {
  const d=fresh(),s=d.screens.Auth;
  s.rows=[{type:'section',key:'absent',rows:[{type:'gap',height:200}]},{type:'buttons',buttons:[{label:'{label}',action:'Password'}]}];
  s.samples._labels={Password:'Password: entered'};s.samples._disabled_actions=['Password'];
  const rows=M.resolve(s);assert.equal(rows.length,1);assert.equal(rows[0].buttons[0].label,'Password: entered');assert.equal(rows[0].buttons[0].enabled,false);
});
test('binding overrides preserve changing data', () => {
  const d=fresh(),s=d.screens.Auth;
  s.rows=[{type:'binding',key:'account',text:'Player: {text}',color:'#FFFFFFFF'}];
  assert.equal(M.resolve(s)[0].text,'Player: Account: Player_Name');
  s.samples.account[0].text='Account: Another';assert.equal(M.resolve(s)[0].text,'Player: Account: Another');
});
test('unsafe or unsupported documents cannot be exported', () => {
  for(const mutate of [d=>d.version=2,d=>d.screens.Auth.width=-10,d=>d.screens.Auth.rows=[{type:'text',text:'x',color:'#fff'}],d=>d.screens.Auth.rows=[{type:'buttons',buttons:[{label:'x',action:'ExecuteCode'}]}],d=>d.screens.Auth.rows=[{type:'buttons',buttons:[{label:'x',action:{Dev:1.5}}]}],d=>d.screens.Auth.rows=[{type:'text',text:'x',color:'#FFFFFFFF',script:'bad'}],d=>delete d.screens.Auth]) {
    const d=fresh();mutate(d);assert.throws(()=>M.validate(d));
  }
});
test('text wrapping and escaping follow native plain-label behavior', () => {
  assert.deepEqual(M.wrap('one two\nthree',28.2),['one ','two','three']);
  const d=fresh();d.screens.Auth.rows=[{type:'text',text:'~r~{red} 50%',color:'#FFFFFFFF'}];
  const text=M.plan(d.screens.Auth).shapes.filter(s=>s.kind==='text').at(-1).text;
  assert.equal(text,'_r__red_ 50_');
});
test('GTA fonts use original atlas slots and proportional widths', () => {
  assert.equal(GAME_FONTS.metrics[0].length,208);assert.equal(GAME_FONTS.metrics[1].length,208);
  const body=GtaGlyph('A',1,GAME_FONTS),menu=GtaGlyph('A',2,GAME_FONTS),heading=GtaGlyph('A',3,GAME_FONTS);
  assert.deepEqual([body.atlas,body.id,body.advance],[0,33,GAME_FONTS.metrics[1][33]]);
  assert.deepEqual([menu.atlas,menu.id],[1,155]);assert.deepEqual([heading.atlas,heading.id],[0,155]);
});

test('client projection and pointer coordinates agree at 4:3, 16:9 and high DPI', () => {
  for(const [w,h] of [[640,480],[1280,960],[1920,1080],[2560,1440]]) {
    const v=M.viewport(),center=v.toPixels(320,224,w,h);
    assert.deepEqual(center,{x:w/2,y:h/2});
    assert.deepEqual(v.toUnits(center.x,center.y,w,h),{x:320,y:224});
    const radio=v.toPixels(344,92,w,h);
    assert.equal(radio.x,344*w/640);assert.equal(radio.y,92*h/448);
  }
  assert.deepEqual(M.viewport().css({x:320,y:224,w:64,h:44.8}),{left:'50%',top:'50%',width:'10%',height:'10%'});
});

test('individual controls have stable paths, independent geometry and native border cost',()=>{
  const d=fresh(),s=d.screens.Auth;s.placement={kind:'at',x:100,y:80};
  s.rows=[{type:'buttons',buttons:[{label:'One',action:'Password',style:{x:7,y:3,scale_x:1.2,scale_y:1.5,height:18,border_width:1,border_color:'#FF0000FF',text_color:'#00FF00FF',text_x:2,font:1}},{label:'Two',action:'Submit'}]}];
  M.validate(d);const p=M.plan(s),hits=p.hits.filter(h=>h.button);
  assert.deepEqual(hits.map(h=>h.path),[[0,'buttons',0],[0,'buttons',1]]);
  assert.deepEqual([hits[0].x,hits[0].y,hits[0].w,hits[0].h],[119,119,129.6,27]);
  assert.equal(hits[1].x,224);assert.equal(hits[1].w,108);
  const one=p.shapes.find(v=>v.kind==='text'&&v.text==='One');assert.equal(one.color,'#00FF00FF');assert.equal(one.font,1);
  assert.equal(p.widgets,12);assert.equal(p.issues.length,0);
  s.rows[0].buttons[0].style.border_width=-1;assert.throws(()=>M.validate(d));
});
test('live binding controls override only the matching offered button',()=>{
  const d=fresh(),s=d.screens.Auth;
  s.rows=[{type:'binding',key:'choices',controls:[{label:'Custom {label}',action:'Password',style:{x:12,border_width:1}},{label:'Never offered',action:'Quit'}]}];
  s.samples.choices=[{type:'buttons',buttons:[{label:'Password live',action:'Password',enabled:false},{label:'Submit live',action:'Submit'}]}];
  M.validate(d);const row=M.resolve(s)[0];assert.equal(row.buttons.length,2);assert.equal(row.buttons[0].label,'Custom Password live');assert.equal(row.buttons[0].enabled,false);assert.equal(row.buttons[1].label,'Submit live');
  const hit=M.plan(s).hits.find(h=>h.button);assert.deepEqual(hit.path,[0,'controls',0]);assert.deepEqual(hit.control.action,'Password');
});
test('variable formatting is single pass and uses the same money and rounding rules as Rust',()=>{
  const values={'player.name':'{{nested}}',cash:-12500,health:99.25,locked:true,tie:-2.5};
  assert.equal(M.formatText('{{player.name}} {{cash|money}} {{health|decimal1}} {{locked|on_off}} {{missing}} {{tie|integer}}',values),'{{nested}} -$12,500 99.3 On - -3');
  const d=fresh();d.screens.Auth.samples._variables=values;d.screens.Auth.rows=[{type:'text',text:'Cash {{cash|money}}',color:'#FFFFFFFF'}];assert.equal(M.resolve(d.screens.Auth)[0].text,'Cash -$12,500');
});
test('independent transforms retain flow height and transform button selection handles',()=>{
  const d=fresh(),s=d.screens.Auth;s.rows=[{type:'transform',x:10,y:4,scale_x:.8,scale_y:1.5,rows:[{type:'buttons',buttons:[{label:'A',action:'Submit'}]}]},{type:'text',text:'Next',color:'#FFFFFFFF'}];
  const base=M.measure(s),p=M.plan(s),hit=p.hits.find(h=>h.button);assert.equal(hit.w,176);assert.equal(hit.h,24);assert.equal(p.height,base.height);assert.equal(p.widgets,7);
});

test('binding slot styling follows live list positions while retaining actual live actions',()=>{
  const d=fresh(),s=d.screens.Auth;
  s.rows=[{type:'binding',key:'choices',controls:[{slot:1,label:'Styled {label}',action:'Quit',style:{border_width:2}}]}];
  s.samples.choices=[{type:'columns',left_width:80,left:[{type:'buttons',buttons:[{label:'First',action:'Password'}]}],right:[{type:'buttons',buttons:[{label:'Second',action:'Submit'}]}]}];
  M.validate(d);const result=M.resolve(s)[0];assert.equal(result.right[0].buttons[0].label,'Styled Second');assert.equal(result.right[0].buttons[0].action,'Submit');assert.equal(result.left[0].buttons[0].label,'First');
  s.samples.choices[0].right[0].buttons[0].action='Back';assert.equal(M.resolve(s)[0].right[0].buttons[0].action,'Back');
});
