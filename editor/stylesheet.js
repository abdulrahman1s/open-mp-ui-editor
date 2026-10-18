/* Editable CSS-style presentation, compiled to the existing native document.
 * This is a bounded declarative language: no imports, expressions or execution. */
(function(root){
  'use strict';
  const clone=value=>JSON.parse(JSON.stringify(value));
  const styleNames={x:'left',y:'top',scale_x:'scale-x',scale_y:'scale-y',height:'height',padding_x:'padding-x',padding_y:'padding-y',text_x:'text-left',text_y:'text-top',text_scale_x:'font-width',text_scale_y:'font-size',font:'font-family',outline:'outline',border_width:'border-width',text_color:'color',background_color:'background-color',border_color:'border-color'};
  const fonts=['gta-bank','gta-standard','gta-menu','gta-heading'];
  const color=value=>typeof value==='string'&&/^#[\da-f]{6}$/i.test(value)?value+'FF':value;
  function scalar(raw){
    const v=raw.trim();if(v.startsWith('"'))return JSON.parse(v);
    if(v.startsWith("'")){
      if(!v.endsWith("'"))throw Error('Unclosed string.');
      let result='';for(let i=1;i<v.length-1;i++){if(v[i]!=='\\'){result+=v[i];continue;}const c=v[++i];if(c==='u'){const hex=v.slice(i+1,i+5);if(!/^[\da-f]{4}$/i.test(hex))throw Error('Invalid Unicode escape.');result+=String.fromCharCode(parseInt(hex,16));i+=4;}else if(Object.hasOwn({n:1,r:1,t:1,'\\':1,"'":1,'"':1},c))result+=({n:'\n',r:'\r',t:'\t','\\':'\\',"'":"'",'"':'"'})[c];else throw Error('Invalid string escape.');}return result;
    }
    if(v==='true')return true;if(v==='false')return false;if(v==='null')return null;
    if(/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(v))return Number(v);
    if(/^[\w.#-]+$/.test(v))return v;
    throw Error('Quote text values, for example content: "Hello";');
  }
  function argumentsOf(text){
    const values=[];let start=0,quote=null,escape=false;
    for(let i=0;i<=text.length;i++){
      const c=text[i];if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c===quote)quote=null;continue;}
      if(c==='"'||c==="'"){quote=c;continue;}if(c===','||i===text.length){if(text.slice(start,i).trim())values.push(scalar(text.slice(start,i)));else if(i!==0)throw Error('Missing action argument.');start=i+1;}
    }
    if(quote)throw Error('Unclosed action argument.');return values;
  }
  function action(raw){const m=/^([A-Za-z]\w*)\s*\(([\s\S]*)\)$/.exec(raw.trim());if(!m)return scalar(raw);const args=argumentsOf(m[2]);return {[m[1]]:args.length===1?args[0]:args};}
  function syntax(source){
    let pos=0,count=0;
    const fail=message=>{throw Error(`ui.css:${source.slice(0,pos).split('\n').length}: ${message}`);};
    function skip(){for(;;){while(/\s/.test(source[pos]||'')&&pos<source.length)pos++;if(source.slice(pos,pos+2)!=='/*')return;const end=source.indexOf('*/',pos+2);if(end<0)fail('Unclosed comment.');pos=end+2;}}
    function entries(depth=0){
      if(depth>14)fail('Nesting limit exceeded.');const result={props:Object.create(null),children:[]};
      for(;;){skip();if(pos>=source.length){if(depth)fail('Missing closing brace.');return result;}if(source[pos]==='}'){if(!depth)fail('Unexpected closing brace.');pos++;return result;}
        if(++count>20000)fail('Too many stylesheet entries.');let text='',quote=null,escape=false,parens=0;
        for(;pos<source.length;pos++){
          const c=source[pos];if(quote){text+=c;if(escape)escape=false;else if(c==='\\')escape=true;else if(c===quote)quote=null;continue;}
          if(c==='"'||c==="'"){quote=c;text+=c;continue;}
          if(source.slice(pos,pos+2)==='/*'){const end=source.indexOf('*/',pos+2);if(end<0)fail('Unclosed comment.');pos=end+1;text+=' ';continue;}
          if(c==='(')parens++;if(c===')'&&--parens<0)fail('Unexpected parenthesis.');
          if(!parens&&['{','}',';'].includes(c))break;text+=c;
        }
        if(quote||parens)fail('Unclosed string or action.');text=text.trim();const delimiter=source[pos++];
        if(delimiter==='{'){if(!text)fail('Expected an element before {.');const child=entries(depth+1);child.selector=text;result.children.push(child);}
        else if(delimiter===';'){const match=/^([a-z][a-z\d-]*)\s*:\s*([\s\S]+)$/i.exec(text);if(!match)fail('Expected property: value;');if(Object.hasOwn(result.props,match[1]))fail('Duplicate property '+match[1]+'.');result.props[match[1]]=match[2].trim();}
        else fail('Expected a semicolon or opening brace.');
      }
    }
    return entries();
  }
  function parse(source,samples={}){
    if(typeof source!=='string'||new TextEncoder().encode(source).length>1024*1024)throw Error('Stylesheet exceeds 1 MiB.');
    const ast=syntax(source),doc={version:1,screens:Object.create(null)};
    const values=(node,mapping)=>{
      const result={};for(const [key,raw]of Object.entries(node.props)){if(!Object.hasOwn(mapping,key))throw Error(`Unknown property ${key} in ${node.selector}.`);const name=mapping[key],v=scalar(raw);result[name]=name.includes('color')?color(v):v;}return result;
    };
    const fields=names=>Object.fromEntries(names.split(' ').filter(Boolean).map(name=>[name.replaceAll('_','-'),name]));
    function button(node){
      const b={},style={};
      for(const [key,raw]of Object.entries(node.props)){
        if(key==='action')b.action=action(raw);
        else if(key==='on-click'){
          if(raw==='none')b.on_click={kind:'none'};
          else if(/^live\(/.test(raw)){const args=argumentsOf(raw.slice(5,-1));b.on_click={kind:'binding',key:args[0],slot:args[1]};}
          else b.on_click={kind:'action',action:action(raw)};
        }else if(key==='content')b.label=scalar(raw);
        else if(Object.values(styleNames).includes(key)){
          const name=Object.keys(styleNames).find(name=>styleNames[name]===key);let v=scalar(raw);if(name==='font'&&typeof v==='string')v=fonts.indexOf(v);style[name]=name.includes('color')?color(v):v;
        }else if(['id','name','locked','hidden','slot','primary','background','enabled','width','body'].includes(key))b[key]=scalar(raw);
        else throw Error(`Unknown button property ${key}.`);
      }
      if(Object.keys(style).length)b.style=style;
      b.label??='{label}';
      for(const child of node.children){const m=/^@state\s+([\s\S]+)$/.exec(child.selector);if(!m||child.children.length)throw Error('Buttons only support @state placement blocks.');const name=String(scalar(m[1]));b.positions||={};if(Object.hasOwn(b.positions,name))throw Error('Duplicate button state '+name+'.');const p=values(child,{left:'x',top:'y'});if(p.x==null||p.y==null)throw Error('State placement needs left and top.');b.positions[name]=p;}
      return b;
    }
    function rows(nodes){return nodes.map(node=>{
      const selector=node.selector;
      if(selector==='button')return {type:'buttons',buttons:[button(node)]};
      if(selector==='native'){if(node.children.length)throw Error('Native primitives cannot contain elements.');return {type:'native',element:JSON.parse(scalar(node.props.element))};}
      if(selector==='text'){if(node.children.length)throw Error('Text cannot contain elements.');return {type:'text',color:'#E1E1C5FF',...values(node,{id:'id',content:'text',color:'color'})};}
      const live=/^live\s+([\s\S]+)$/.exec(selector),when=/^when\s+([\s\S]+)$/.exec(selector);
      if(live){const r={type:'binding',key:String(scalar(live[1])),...values(node,{content:'text',color:'color',...fields('primary background width')})};if(node.children.length){if(node.children.some(c=>c.selector!=='button'))throw Error('Live values can contain button overrides only.');r.controls=node.children.map(button);}return r;}
      if(when)return {type:'section',key:String(scalar(when[1])),...values(node,{}),rows:rows(node.children)};
      if(selector==='group'){
        if(node.props.display==='flex'){
          const props={...node.props};delete props.display;
          if(node.children.some(c=>c.selector!=='button'))throw Error('A horizontal group contains buttons only.');
          return {type:'buttons',buttons:node.children.map(button),...values({...node,props},{width:'width'})};
        }
        return {type:'transform',x:0,y:0,scale_x:1,scale_y:1,...values(node,{left:'x',top:'y',...fields('id scale_x scale_y width name hidden locked')}),rows:rows(node.children)};
      }
      if(selector==='columns'){
        if(node.children.length!==2||node.children.some(c=>!['left','right'].includes(c.selector))||node.children[0].selector===node.children[1].selector)throw Error('Columns need one left and one right block.');
        for(const child of node.children)values(child,{});
        return {type:'columns',left_width:0,...values(node,fields('left_width')),left:rows(node.children.find(c=>c.selector==='left').children),right:rows(node.children.find(c=>c.selector==='right').children)};
      }
      const kinds={spacer:['gap',fields('height')],divider:['rule',{}],sprite:['sprite',fields('id texture width height color')],model:['preview',fields('id model')]};
      if(kinds[selector]){if(node.children.length)throw Error(selector+' cannot contain elements.');return {type:kinds[selector][0],...values(node,kinds[selector][1])};}
      throw Error('Unknown element '+selector+'.');
    });}
    if(Object.keys(ast.props).length)throw Error('Properties belong inside an @screen block.');
    for(const node of ast.children){
      const match=/^@screen\s+([\s\S]+)$/.exec(node.selector);if(!match)throw Error('Expected @screen Name { ... }.');const name=String(scalar(match[1]));if(Object.hasOwn(doc.screens,name))throw Error('Duplicate screen '+name+'.');
      const props={...node.props},placement=props.placement;delete props.placement;const left=props.left,top=props.top;delete props.left;delete props.top;
      if(placement!=null&&(left!=null||top!=null))throw Error('Use placement or left/top, not both.');
      const s={title:name,width:220,compact:true,...values({...node,props},fields('native title width compact scale')),placement:left!=null||top!=null?{kind:'at',x:left==null?0:scalar(left),y:top==null?0:scalar(top)}:{kind:placement==null?'center':scalar(placement)},rows:rows(node.children)};
      if(Object.hasOwn(samples,name))s.samples=clone(samples[name]);doc.screens[name]=s;
    }
    return root.UiDocument.validate(clone(doc));
  }
  const quote=value=>JSON.stringify(value);
  function stringify(doc){
    root.UiDocument.validate(doc);const lines=['/* open.mp UI project source. Edit this file or use the visual editor.',' * Distances use native TextDraw units (640 × 480), not browser pixels.',' * Export runtime JSON to load on the server; fixture values freeze at export.',' * Save project JSON to preserve layout, samples and interaction IDs. */',''];
    const emit=(depth,text)=>lines.push('  '.repeat(depth)+text);
    const value=(key,v)=>key.includes('color')&&typeof v==='string'?v:typeof v==='string'?quote(v):String(v);
    function props(obj,depth,aliases={},exclude=[]){for(const [k,v]of Object.entries(obj)){if(exclude.includes(k)||v===undefined)continue;const name=aliases[k]||k.replaceAll('_','-');emit(depth,name+': '+value(name,v)+';');}}
    function actionValue(a){if(typeof a==='string')return a;const [name,arg]=Object.entries(a)[0];return name+'('+(Array.isArray(arg)?arg:[arg]).map(v=>typeof v==='string'?quote(v):String(v)).join(', ')+')';}
    function button(b,depth){
      emit(depth,'button {');emit(depth+1,'content: '+quote(b.label)+';');emit(depth+1,'action: '+actionValue(b.action)+';');
      props(b,depth+1,{},['label','action','style','positions','on_click']);
      if(b.style)for(const [k,v]of Object.entries(b.style)){if(v===undefined)continue;emit(depth+1,styleNames[k]+': '+(k==='font'&&v!=null?fonts[v]:value(styleNames[k],v))+';');}
      if(b.on_click){const c=b.on_click;emit(depth+1,'on-click: '+(c.kind==='none'?'none':c.kind==='binding'?'live('+quote(c.key)+', '+c.slot+')':actionValue(c.action))+';');}
      for(const [name,p]of Object.entries(b.positions||{})){emit(depth+1,'@state '+quote(name)+' {');props(p,depth+2,{x:'left',y:'top'});emit(depth+1,'}');}emit(depth,'}');
    }
    function rows(rs,depth){for(const r of rs){
      if(r.type==='buttons'&&r.buttons.length===1&&r.width==null){button(r.buttons[0],depth);continue;}
      if(r.type==='native'){emit(depth,'native {');emit(depth+1,'element: '+quote(JSON.stringify(r.element))+';');emit(depth,'}');continue;}
      const selector={text:'text',buttons:'group',binding:'live '+quote(r.key),section:'when '+quote(r.key),transform:'group',columns:'columns',gap:'spacer',rule:'divider',sprite:'sprite',preview:'model'}[r.type];emit(depth,selector+' {');
      if(r.type==='buttons'){emit(depth+1,'display: flex;');if(r.width!=null)emit(depth+1,'width: '+r.width+';');for(const b of r.buttons)button(b,depth+1);}
      else if(r.type==='columns'){if(r.left_width!==0)emit(depth+1,'left-width: '+r.left_width+';');for(const side of ['left','right']){emit(depth+1,side+' {');rows(r[side],depth+2);emit(depth+1,'}');}}
      else {props(r,depth+1,{text:'content',x:'left',y:'top'},['type','key','rows','controls']);if(r.rows)rows(r.rows,depth+1);if(r.controls)for(const b of r.controls)button(b,depth+1);}
      emit(depth,'}');
    }}
    for(const [name,s]of Object.entries(doc.screens)){emit(0,'@screen '+quote(name)+' {');props(s,1,{},['placement','rows','samples']);if(s.placement.kind==='at')props(s.placement,1,{x:'left',y:'top'},['kind']);else emit(1,'placement: '+s.placement.kind+';');rows(s.rows,1);emit(0,'}');lines.push('');}
    return lines.join('\n');
  }
  const samples=doc=>Object.fromEntries(Object.entries(doc.screens).filter(([,s])=>Object.hasOwn(s,'samples')).map(([name,s])=>[name,clone(s.samples)]));
  root.UiStylesheet={parse,stringify,samples};if(typeof module!=='undefined')module.exports=root.UiStylesheet;
})(globalThis);
