const {test}=require('node:test');
const assert=require('node:assert/strict');
const {create}=require('./history.js');
const context=(screenName='Auth',state='default',selected=[0])=>({screenName,state,selected});
test('undo groups typing, restores selection/state, and redoes the completed edit',()=>{
  const h=create({value:'start',context:context()});
  h.commit('a',context('Clothing','Empty',[2]),{label:'Caption',mergeKey:'caption',now:0});
  h.commit('ab',context('Clothing','Empty',[2]),{label:'Caption',mergeKey:'caption',now:100});
  assert.equal(h.entries.length,2);assert.equal(h.undo().value,'start');
  assert.deepEqual(h.redo(),{value:'ab',context:context('Clothing','Empty',[2]),label:'Caption'});
});
test('new edits discard redo while selection changes and no-op commits preserve it',()=>{
  const h=create({value:'a',context:context()});h.commit('b',context(),{label:'Move'});h.undo();
  h.capture(context('Bank'));assert.equal(h.commit('a',context('Bank')),false);assert.equal(h.redoLabel,'Move');
  h.commit('c',context('Bank'),{label:'Delete'});assert.equal(h.redo(),null);assert.equal(h.undo().context.screenName,'Bank');
});
test('separate gestures stay separate, timeline jumps work, history is bounded',()=>{
  const h=create({value:'0',context:context()},{limit:2});
  for(let i=1;i<=3;i++){h.breakGroup();h.commit(String(i),context(),{label:'Nudge',mergeKey:'move',now:i});}
  assert.equal(h.entries.length,3);assert.equal(h.jump(0).value,'1');assert.equal(h.undo(),null);
  assert.equal(h.jump(2).value,'3');assert.equal(h.undoLabel,'Nudge');
});
test('saved history preserves undo and redo across refresh, and ignores a different document',()=>{
  const h=create({value:'a',context:context()});h.commit('b',context(),{label:'Move'});h.commit('c',context(),{label:'Resize'});h.undo();
  const restored=create({value:'b',context:context()},{saved:JSON.parse(JSON.stringify(h.snapshot()))});
  assert.equal(restored.redo().value,'c');assert.equal(restored.undo().value,'b');assert.equal(restored.undo().value,'a');
  assert.equal(create({value:'unrelated',context:context()},{saved:h.snapshot()}).undo(),null);
  assert.equal(create({value:'b',context:context()},{saved:{version:1,index:99,steps:[]}}).undo(),null);
});
test('persisted snapshots stay bounded without changing session history or losing the current step',()=>{
  const h=create({value:'a',context:context()});for(let i=0;i<10;i++)h.commit(String(i),context());
  const saved=h.snapshot({maxBytes:300});assert.equal(saved.steps[saved.index].value,'9');assert.ok(JSON.stringify(saved).length<=300);assert.equal(h.entries.length,11);
});
