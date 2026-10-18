/* Text editing targets preserve dynamic templates and commit only authored text. */
(function(root){
  'use strict';
  const at=(screen,path)=>path.reduce((value,key)=>value?.[key],screen.rows);
  function template(screen,binding){
    function find(rows){for(const row of rows||[]){if(row.type==='binding'&&row.key===binding.key&&row.text&&row.text!=='{text}')return row.text;for(const children of [row.rows,row.left,row.right]){const result=find(children);if(result)return result;}}}
    return binding.text&&binding.text!=='{text}'?binding.text:find(screen?.rows)||'{text}';
  }
  function begin(screen,path,{name='',defaults=null,preview=screen}={}){
    if(!screen)return null;
    let owner=path===null?screen:at(screen,path),kind,key,limit;
    while(owner?.type==='transform'&&owner.rows.length===1)owner=owner.rows[0];
    if(path===null){kind='title';key='title';limit=512;}
    else if(owner&&Object.hasOwn(owner,'action')){kind='button';key='label';limit=512;}
    else if(owner?.type==='native'&&owner.element.kind==='text'){owner=owner.element;kind='text';key='text';limit=512;}
    else if(owner?.type==='text'){kind='text';key='text';limit=2048;}
    else if(owner?.type==='binding'&&(preview.samples?.[owner.key]||[]).some(row=>row.type==='text')&&(preview.samples[owner.key]||[]).every(row=>row.type==='text'||row.type==='gap')){kind='binding';key='text';limit=2048;}
    else return null;
    const value=kind==='button'?root.UiDocument.captionTemplate(name,owner):kind==='binding'?template(defaults,owner):owner[key];
    return {owner,key,kind,value,limit,multiline:kind==='text'||kind==='binding',apply(next){
      if(typeof next!=='string'||new TextEncoder().encode(next).length>limit)throw Error('Text is too long (maximum '+limit+' characters).');
      if(next===value)return false;owner[key]=next;return true;
    }};
  }
  root.UiCanvasText={begin,template};if(typeof module!=='undefined')module.exports=root.UiCanvasText;
})(globalThis);
