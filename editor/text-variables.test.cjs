const {test}=require('node:test');
const assert=require('node:assert/strict');
const {tokenAt,suggestions}=require('./text-variables.js');
test('completion identifies the current token and replaces an existing suffix without eating surrounding text',()=>{
  assert.deepEqual(tokenAt('Outfit {{outfit.in',18),{start:7,end:18,query:'outfit.in'});
  assert.deepEqual(tokenAt('Hello {{player.name}}!',13),{start:6,end:21,query:'playe'});
  assert.equal(tokenAt('Hello {{player.name}}!',22),null);
  assert.equal(tokenAt('Hello {{player.name}}!',8,10),null);
  assert.equal(tokenAt('Already {{done}} and {{out',26)?.query,'out');
});
test('completion searches readable labels and keys and inserts formatted tokens',()=>{
  const vars=[{key:'outfit.index',label:'Outfit number',group:'Wardrobe',format:'integer'},{key:'player.cash',label:'Cash balance',group:'Player',format:'money'}];
  assert.equal(suggestions(vars,'out num')[0].token,'{{outfit.index|integer}}');
  assert.equal(suggestions(vars,'player.cash')[0].token,'{{player.cash|money}}');
  assert.equal(suggestions(vars,'cash|integer')[0].token,'{{player.cash|integer}}');
  assert.deepEqual(suggestions(vars,'invalid'),[]);
});
