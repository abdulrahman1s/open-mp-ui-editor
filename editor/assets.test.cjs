const {test}=require('node:test');
const assert=require('node:assert/strict');
require('./game-fonts.js');require('./sprites.js');
test('the public preview bundles both original GTA PNG atlases and proportional metrics',()=>{
  for(const name of ['font1','font2']){
    const data=Buffer.from(GAME_FONTS.textures[name].split(',')[1],'base64');
    assert.equal(data.subarray(1,4).toString(),'PNG');
    assert.equal(data.readUInt32BE(16),512);assert.equal(data.readUInt32BE(20),512);
  }
  for(const widths of GAME_FONTS.metrics){assert.equal(widths.length,208);assert.ok(new Set(widths).size>10);}
});
test('all 449 native sprites have embedded offline previews instead of placeholders',()=>{
  assert.equal(Object.keys(GAME_SPRITES).length,449);
  for(const [name,asset] of Object.entries(GAME_SPRITES)){
    assert.match(asset.image,/^data:image\/png;base64,/ ,name);
    const data=Buffer.from(asset.image.split(',')[1],'base64');
    assert.equal(data.subarray(1,4).toString(),'PNG',name);
    assert.ok(data.readUInt32BE(16)>0 && data.readUInt32BE(20)>0,name);
  }
});
