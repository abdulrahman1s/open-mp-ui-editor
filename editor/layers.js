/* Layer operations own paths and JSON representation; editor and tests cross
 * this same seam. Metadata uses native-supported transforms and buttons. */
(function (root) {
  'use strict';
  const get = (screen, path) => path.reduce((value, key) => value[key], screen.rows);
  const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  const button = value => value && Object.hasOwn(value, 'action');
  function state(screen, path) {
    const result = { locked:false, hidden:false };
    for (let i=1; i<=path.length; i++) {
      const value=get(screen,path.slice(0,i));
      result.locked ||= value?.locked === true; result.hidden ||= value?.hidden === true;
    }
    return result;
  }
  function metadata(screen, path, key, value) {
    if (!['name','hidden','locked'].includes(key)) throw Error('Unknown layer setting.');
    let target=get(screen,path);
    if (!target || Array.isArray(target)) throw Error('Select a layer first.');
    if (target.type!=='transform' && !button(target)) {
      const parent=get(screen,path.slice(0,-1));
      target=parent[path.at(-1)]={type:'transform',x:0,y:0,scale_x:1,scale_y:1,rows:[target]};
    }
    target[key]=value;
  }
  function checkUnlocked(screen, paths) {
    if(paths.some(path=>state(screen,path).locked))throw Error('Unlock the layer before editing it.');
  }
  function siblings(screen, paths) {
    if(!paths.length)throw Error('Select layers first.');
    const parent=paths[0].slice(0,-1);
    if(!paths.every(path=>same(path.slice(0,-1),parent)))throw Error('Choose layers in the same group.');
    const indexes=[...new Set(paths.map(path=>path.at(-1)))].sort((a,b)=>a-b);
    if(!indexes.every(Number.isInteger))throw Error('Select layers, rather than a column heading.');
    return {parent,rows:get(screen,parent),indexes};
  }
  function group(screen, paths) {
    checkUnlocked(screen,paths);const {parent,rows,indexes}=siblings(screen,paths);
    if(indexes.some(i=>button(rows[i])))throw Error('Group button rows rather than individual buttons.');
    const children=indexes.map(i=>rows[i]);
    for(const i of [...indexes].reverse())rows.splice(i,1);
    rows.splice(indexes[0],0,{type:'transform',name:'Group',x:0,y:0,scale_x:1,scale_y:1,rows:children});
    return [...parent,indexes[0]];
  }
  function ungroup(screen,path) {
    checkUnlocked(screen,[path]);const target=get(screen,path);
    if(target?.type!=='transform')throw Error('Select a group first.');
    if(target.x!==0||target.y!==0||target.scale_x!==1||target.scale_y!==1||target.width!=null||target.hidden)throw Error('Reset the group position/size and show it before ungrouping.');
    get(screen,path.slice(0,-1)).splice(path.at(-1),1,...target.rows);
  }
  function move(screen,from,to,inside=false) {
    checkUnlocked(screen,[from,to]);
    if(same(from,to))return from;
    if(from.at(-2)==='controls'||to.at(-2)==='controls')throw Error('Live list order follows the game data. Drag on the canvas to reposition its buttons.');
    if(button(get(screen,from))&&button(get(screen,to))&&!same(from.slice(0,-1),to.slice(0,-1))&&get(screen,from.slice(0,-1)).length===1){
      const a=owner(screen,from),b=owner(screen,to.slice(0,-2));return [...move(screen,a,b),...from.slice(a.length)];
    }
    if(same(from,to.slice(0,from.length)))throw Error('A group cannot contain itself.');
    const origin=get(screen,from.slice(0,-1)),target=get(screen,to);
    const destination=inside?target.rows:get(screen,to.slice(0,-1));
    if(!Array.isArray(destination))throw Error('Drop inside a group or beside another layer.');
    const value=get(screen,from);
    if(button(value)!==(!inside&&button(target)))throw Error('Keep buttons within button rows.');
    const adjusted=to.slice();
    // Removing an earlier sibling shifts a destination path, including descendants.
    const parent=from.slice(0,-1);
    if(same(parent,to.slice(0,parent.length))&&Number.isInteger(to[parent.length])&&from.at(-1)<to[parent.length])adjusted[parent.length]--;
    origin.splice(from.at(-1),1);
    const destinationPath=inside?[...adjusted,'rows']:adjusted.slice(0,-1);
    const index=inside?get(screen,destinationPath).length:adjusted.at(-1);
    get(screen,destinationPath).splice(index,0,value);
    return [...destinationPath,index];
  }
  function owner(screen,path){
    let result=path.slice();
    if(button(get(screen,result))){if(result.at(-2)==='controls')return null;if(get(screen,result.slice(0,-1)).length>1)return result;result=result.slice(0,-2);}
    while(result.at(-1)===0&&result.at(-2)==='rows'){
      const parent=result.slice(0,-2),value=get(screen,parent);if(value?.type!=='transform'||value.rows.length!==1)break;result=parent;
    }
    return result;
  }
  function stepTarget(screen,path,direction){
    if(state(screen,path).locked)return null;
    const target=owner(screen,path);if(!target)return null;
    const items=get(screen,target.slice(0,-1)),index=target.at(-1)+direction;
    if(!Array.isArray(items)||index<0||index>=items.length)return null;
    const next=[...target.slice(0,-1),index];return state(screen,next).locked?null:{path:target,next};
  }
  function step(screen,path,direction){
    const target=stepTarget(screen,path,direction);if(!target)return null;
    const items=get(screen,target.path.slice(0,-1)),i=target.path.at(-1),j=target.next.at(-1),suffix=path.slice(target.path.length);
    [items[i],items[j]]=[items[j],items[i]];return [...target.next,...suffix];
  }
  function prune(screen,path){
    while(path.length){const value=get(screen,path);if(!(value?.type==='buttons'&&!value.buttons.length||value?.type==='transform'&&!value.rows.length))return;
      get(screen,path.slice(0,-1)).splice(path.at(-1),1);path=path.slice(0,-2);
    }
  }
  function remove(screen,paths){
    checkUnlocked(screen,paths);
    const ordered=paths.filter(path=>!paths.some(other=>other.length<path.length&&same(other,path.slice(0,other.length)))).sort((a,b)=>{for(let i=0;i<Math.min(a.length,b.length);i++)if(a[i]!==b[i])return typeof a[i]==='number'?b[i]-a[i]:String(b[i]).localeCompare(String(a[i]));return b.length-a.length;});
    for(const path of ordered){if(path.at(-2)==='controls'){get(screen,path).hidden=true;continue;}
      get(screen,path.slice(0,-1)).splice(path.at(-1),1);prune(screen,path.slice(0,-2));}
  }
  function duplicate(screen,path){
    checkUnlocked(screen,[path]);const value=get(screen,path);
    if(path.at(-2)==='controls'){
      const bindingPath=path.slice(0,-2),binding=get(screen,bindingPath),copy=JSON.parse(JSON.stringify(value));
      const sample=UiDocument.resolve(screen).flatMap(function collect(row){return row.type==='buttons'?row.buttons:row.rows?.flatMap(collect)||[...(row.left?.flatMap(collect)||[]),...(row.right?.flatMap(collect)||[])];}).find(b=>b.control&&same(b.control.binding,bindingPath)&&b.control.slot===value.slot);
      copy.label=copy.label.replaceAll('{label}',sample?.label||'Button');copy.on_click={kind:'binding',key:binding.key,slot:value.slot??sample?.control.slot??0};delete copy.slot;delete copy.hidden;
      const row={type:'buttons',buttons:[copy]},base=owner(screen,bindingPath),parent=get(screen,base.slice(0,-1)),index=base.at(-1)+1;parent.splice(index,0,row);return [...base.slice(0,-1),index,'buttons',0];
    }
    const base=owner(screen,path),copy=JSON.parse(JSON.stringify(get(screen,base))),items=get(screen,base.slice(0,-1));
    if(button(copy)&&items.length>=8)throw Error('This horizontal group is full. Add another button from the tool rail.');
    if(copy.name)copy.name+=' copy';const index=base.at(-1)+1;items.splice(index,0,copy);return [...base.slice(0,-1),index,...path.slice(base.length)];
  }
  function duplicateAll(screen,paths){
    checkUnlocked(screen,paths);const refs=[];
    for(const path of [...paths].sort((a,b)=>{for(let i=0;i<Math.min(a.length,b.length);i++)if(a[i]!==b[i])return typeof a[i]==='number'?b[i]-a[i]:String(b[i]).localeCompare(String(a[i]));return b.length-a.length;}))refs.push(get(screen,duplicate(screen,path)));
    const result=[];function visit(value,path){if(refs.includes(value))result.push(path);if(Array.isArray(value))value.forEach((v,i)=>visit(v,[...path,i]));else if(value&&typeof value==='object')for(const k of ['rows','left','right','buttons','controls'])if(value[k])visit(value[k],[...path,k]);}visit(screen.rows,[]);return result;
  }
  root.UiLayers={get,state,metadata,group,ungroup,move,checkUnlocked,siblings,owner,stepTarget,step,remove,duplicate,duplicateAll};
  if(typeof module!=='undefined')module.exports=root.UiLayers;
})(globalThis);
