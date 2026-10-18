const {test}=require('node:test');
const assert=require('node:assert/strict');
const {snap}=require('./guides.js');
test('magnetic centers snap exactly on both axes within a pixel-derived threshold',()=>{
  const r=snap({x:268.3,y:197.5,w:100,h:50},[{x:0,y:0,w:640,h:448,centerOnly:true}],{threshold:4});
  assert.ok(Math.abs(r.dx-1.7)<1e-10);assert.equal(r.dy,1.5);assert.equal(r.lines.length,2);
});
test('edges and sibling centers attract while distant objects and disabled axes do not',()=>{
  const moving={x:100,y:90,w:50,h:20},targets=[{x:152,y:400,w:50,h:20}];
  assert.equal(snap(moving,targets).dx,2);assert.equal(snap(moving,targets).dy,0);
  assert.equal(snap(moving,targets,{x:false}).dx,0);
  assert.equal(snap(moving,targets,{threshold:1}).lines.length,0);
});
test('canvas centers attract only the moving center, and ties prefer matching anchors',()=>{
  assert.equal(snap({x:319,y:0,w:40,h:20},[{x:0,y:0,w:640,h:448,centerOnly:true}]).dx,0);
  const r=snap({x:101,y:20,w:50,h:20},[{x:100,y:40,w:50,h:20}]);
  assert.equal(r.dx,-1);assert.equal(r.lines[0].position,100);
});
