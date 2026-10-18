const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
require('./tests/fixtures/actions.js');require('./tests/fixtures/defaults.js');const M=require('./model.js'),S=require('./stylesheet.js');
test('CSS-style source round trips every existing layout without changing rendering or previews',()=>{
  const css=S.stringify(DEFAULT_UI),doc=S.parse(css,S.samples(DEFAULT_UI));assert.deepEqual(doc,DEFAULT_UI);
  for(const name of Object.keys(doc.screens))assert.deepEqual(M.clone(M.plan(doc.screens[name])),M.clone(M.plan(DEFAULT_UI.screens[name])));
  assert.ok(!css.includes('"rows"'));assert.ok(css.includes('button {'));
});
test('styles, named live values, actions, state positions and quoted delimiters compile safely',()=>{
  const doc=M.clone(DEFAULT_UI),s=doc.screens.Auth;
  s.rows=[{type:'buttons',buttons:[{label:'Go; {label} /* still text */',action:{Open:'Services'},style:{font:1,text_color:'#FFFFFFFF',height:22,padding_x:5},on_click:{kind:'binding',key:'offers',slot:1},positions:{Register:{x:4,y:3},default:{x:0,y:0}}}]},{type:'transform',x:2,y:0,scale_x:1,scale_y:1,width:100,rows:[{type:'text',text:'Player {{player.name}}\n"Quoted"',color:'#FFFFFFFF'}]}];
  assert.deepEqual(S.parse(S.stringify(doc),S.samples(doc)),doc);
  const css=S.stringify(doc).replace('color: #FFFFFFFF;','color: #FFFFFF;');assert.deepEqual(S.parse(css,S.samples(doc)),doc);
});
test('malformed CSS, unknown properties and untrusted actions fail without evaluating content',()=>{
  const css=S.stringify(DEFAULT_UI);
  const invalid=[css+'}',css.replace('width:','made-up:'),css.replace('title:','title: "one"; title:'),css.replace(/action: [^;]+;/,'action: Execute("x");'),css.replace(/title: [^;]+;/,'title: eval("alert(1)");'),css+'\n@import "https://example.com";',css.replace(/;\n/,'\n')];
  invalid.forEach((bad,i)=>assert.throws(()=>S.parse(bad,S.samples(DEFAULT_UI)),undefined,'Malformed case '+i));
});
