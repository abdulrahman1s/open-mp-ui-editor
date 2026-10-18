/* The document is shared with Rust. This module measures/render-plans it; DOM
 * code and WebGL know nothing about live player state. Node tests use this seam. */
(function (root) {
  'use strict';
  const TEXT = '#E1E1C5FF', MUTED = '#A9AFADFF', ACCENT = '#D6B879FF';
  const clone = value => JSON.parse(JSON.stringify(value));
  const key = value => typeof value === 'string' ? value : JSON.stringify(value);
  const captionTemplate = (screenName,button) => button.label==='{label}'&&root.UI_CAPTION_TEMPLATES?.[screenName]?.[key(button.action)]||button.label.replaceAll('{label}','{{button.caption}}');
  const buttonPosition = (button, state = 'default') => ({x:button.style?.x??0,y:button.style?.y??0,...button.positions?.[state]});
  function setButtonPosition(button, state, position) {
    const next={...buttonPosition(button,state),...position};
    button.positions ||= {};button.positions[state]=next;
  }
  function positionedButton(button, state) {
    return button.positions?.[state] ? {...button,style:{...button.style,...buttonPosition(button,state)}} : button;
  }
  function interactionChoices(screen){
    const choices=[],seen=new Set(),samples=screen.samples||{},disabled=(samples._disabled_actions||[]).map(key),hidden=(samples._hidden_actions||[]).map(key);
    const visit=(rows,binding=null,slot={value:0})=>{for(const row of rows||[]){for(const button of row.buttons||[]){const index=slot.value++,target=binding?{kind:'binding',key:binding,slot:index}:{kind:'action',action:button.action},id=JSON.stringify(target);if(!hidden.includes(key(button.action))&&!seen.has(id)){seen.add(id);choices.push({target,button:{...button,enabled:button.enabled!==false&&!disabled.includes(key(button.action))},label:button.label.replaceAll('{label}',samples._labels?.[key(button.action)]||key(button.action))||'Favorite station'});}}for(const children of [row.rows,row.left,row.right])if(children)visit(children,binding,slot);}};
    visit(screen.rows);
    for(const [binding,rows]of Object.entries(samples))if(!binding.startsWith('_')&&Array.isArray(rows))visit(rows,binding);
    return choices;
  }
  const safe = value => value.replace(/[\x00-\x1f\x7f{}~%]/g, '_');
  function formatValue(value,format='text'){
    if(format==='text'||format==='')return String(value);
    if(format==='upper')return String(value).toUpperCase();if(format==='lower')return String(value).toLowerCase();
    if(format==='on_off'||format==='yes_no')return typeof value==='boolean'?(format==='on_off'?(value?'On':'Off'):(value?'Yes':'No')):'-';
    if(typeof value!=='number'||!Number.isFinite(value))return '-';
    const rounded=d=>{const f=10**d;return (Math.sign(value)*Math.round(Math.abs(value)*f)/f).toFixed(d);};
    const whole=rounded(0),grouped=whole.replace(/\B(?=(\d{3})+(?!\d))/g,',');
    if(format==='money')return grouped.startsWith('-')?'-$'+grouped.slice(1):'$'+grouped;
    if(format==='number')return grouped;if(format==='integer')return whole;
    if(format==='decimal1')return rounded(1);if(format==='decimal2')return rounded(2);return '-';
  }
  function formatText(template,values={}){return template.replace(/\{\{([^{}]*?)\}\}/g,(_,token)=>{const [name,format='text']=token.split('|');return Object.hasOwn(values,name.trim())?formatValue(values[name.trim()],format.trim()):'-';});}
  function wrap(text, width) {
    const columns = Math.max(1, Math.floor(width / 4.7)), lines = [];
    for (const paragraph of text.split('\n')) {
      let line = [];
      for (const word of paragraph.split(/\s+/u).filter(Boolean)) {
        if (line.length && line.length + 1 + [...word].length > columns) { lines.push(line.join('')); line = []; }
        for (const c of word) {
          if (line.length === columns) { lines.push(line.join('')); line = []; }
          line.push(c);
        }
        line.push(' ');
      }
      lines.push(line.join('').trimEnd());
    }
    return lines;
  }
  function validate(doc) {
    if (!doc || doc.version !== 1 || !doc.screens || typeof doc.screens !== 'object' || Array.isArray(doc.screens)) throw Error('Expected a version 1 server UI document.');
    if (JSON.stringify(doc).length > 512 * 1024) throw Error('Document exceeds 512 KiB.');
    const number = (v, min, max, name) => { if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw Error(`Invalid ${name}.`); };
    const string = (v, max, name) => { if (typeof v !== 'string' || v.length > max) throw Error(`Invalid ${name}.`); };
    const color = v => { if (typeof v !== 'string' || !/^#[\da-f]{8}$/i.test(v)) throw Error('Colors use #RRGGBBAA.'); };
    const allowed = (obj, names) => { for (const k of Object.keys(obj)) if (!names.includes(k)) throw Error(`Unknown field: ${k}`); };
    allowed(doc,['version','screens']);
    function action(value) {
      if(root.OPEN_MP_EDITOR && typeof value==='string' && /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(value))return;
      const name=typeof value==='string'?value:Object.keys(value)[0], types=root.UI_VOCABULARY?.actions[name];
      if(!types)throw Error(`Unknown server action: ${name}`);
      if(!types.length){if(typeof value!=='string')throw Error(`${name} takes no arguments.`);return;}
      if(typeof value==='string')throw Error(`${name} needs arguments.`);
      const args=types.length===1?[value[name]]:value[name];
      if(!Array.isArray(args)||args.length!==types.length)throw Error(`Invalid arguments for ${name}.`);
      types.forEach((type,i)=>{const v=args[i];if(type==='i32'||type==='u32'){if(!Number.isInteger(v)||v<(type==='u32'?0:-2147483648)||v>(type==='u32'?4294967295:2147483647))throw Error(`Invalid integer for ${name}.`);}else if(type==='bool'){if(typeof v!=='boolean')throw Error(`Invalid boolean for ${name}.`);}else if(type==='Screen'){if(!root.UI_VOCABULARY.screens.includes(v))throw Error(`Unknown server screen: ${v}`);}else string(v,2048,`${name} argument`);});
    }
    function buttons(bs){
      if(!Array.isArray(bs)||bs.length>64)throw Error('Invalid button overrides.');
      for(const b of bs){
        allowed(b,['id','label','action','primary','background','enabled','width','body','style','slot','name','locked','hidden','positions','on_click']);string(b.label,512,'button caption');if(b.name!=null){string(b.name,128,'layer name');if(new TextEncoder().encode(b.name).length>128)throw Error('Layer name is too long.');}
        if(b.on_click!=null){const target=b.on_click;if(!target||typeof target!=='object'||Array.isArray(target))throw Error('Invalid click action.');if(target.kind==='none')allowed(target,['kind']);else if(target.kind==='action'){allowed(target,['kind','action']);action(target.action);}else if(target.kind==='binding'){allowed(target,['kind','key','slot']);string(target.key,64,'binding key');number(target.slot,0,63,'action slot');if(!target.key||!Number.isInteger(target.slot))throw Error('Invalid action slot.');}else throw Error('Invalid click action.');}
        if(b.positions!=null){
          if(typeof b.positions!=='object'||Array.isArray(b.positions)||Object.keys(b.positions).length>32)throw Error('Invalid button state positions.');
          for(const [state,p]of Object.entries(b.positions)){string(state,64,'state name');if(!state||new TextEncoder().encode(state).length>64||!p||typeof p!=='object'||Array.isArray(p))throw Error('Invalid button state position.');allowed(p,['x','y']);number(p.x,-640,640,'state X offset');number(p.y,-480,480,'state Y offset');}
        }
        if(!(typeof b.action==='string'||b.action&&typeof b.action==='object'&&!Array.isArray(b.action)&&Object.keys(b.action).length===1))throw Error('Invalid action.');
        action(b.action);
        if(b.slot!=null){number(b.slot,0,63,'binding slot');if(!Number.isInteger(b.slot))throw Error('Invalid binding slot.');}
        for(const k of ['primary','background','enabled','body','locked','hidden'])if(b[k]!=null&&typeof b[k]!=='boolean')throw Error(`Invalid button ${k}.`);
        if(b.width!=null)number(b.width,.01,640,'button width');
        if(b.style!=null){
          const ranges={x:[-640,640],y:[-480,480],scale_x:[.1,4],scale_y:[.1,4],height:[1,480],padding_x:[0,100],padding_y:[0,100],text_x:[-640,640],text_y:[-480,480],text_scale_x:[.01,4],text_scale_y:[.01,10],font:[0,3],outline:[0,8],border_width:[0,20]};
          allowed(b.style,[...Object.keys(ranges),'text_color','background_color','border_color']);
          for(const [k,range] of Object.entries(ranges))if(b.style[k]!=null)number(b.style[k],...range,`button ${k}`);
          for(const k of ['font','outline'])if(b.style[k]!=null&&!Number.isInteger(b.style[k]))throw Error(`Invalid button ${k}.`);
          for(const k of ['text_color','background_color','border_color'])if(b.style[k]!=null)color(b.style[k]);
        }
      }
    }
    function rows(rs, width, depth) {
      if (!Array.isArray(rs) || rs.length > (root.OPEN_MP_EDITOR?128:96) || depth > 6) throw Error('Row/nesting limit exceeded.');
      for (const r of rs) {
        if (!r || typeof r !== 'object') throw Error('Invalid row.');
        const fields={native:['element'],text:['text','color'],gap:['height'],rule:[],preview:['model'],sprite:['texture','width','height','color'],binding:['key','text','color','primary','background','width','controls'],section:['key','rows'],transform:['x','y','scale_x','scale_y','width','rows','name','hidden','locked'],columns:['left','right','left_width'],buttons:['buttons','width']};
        if(!fields[r.type])throw Error(`Unknown row type: ${r.type}`);
        allowed(r,['type','id',...fields[r.type]]);if(r.id!=null)string(r.id,64,'element ID');
        switch (r.type) {
          case 'native': root.OpenMpExport.validate({format:'open-mp-ui',version:1,name:'Imported',elements:[r.element]});break;
          case 'text': string(r.text, 2048, 'text'); color(r.color); break;
          case 'gap': number(r.height, 0, 390, 'gap'); break;
          case 'rule': break;
          case 'preview': number(r.model, 0, 20000, 'model'); if (!Number.isInteger(r.model)) throw Error('Model IDs must be integers.'); break;
          case 'sprite':string(r.texture,96,'sprite texture');if(!/^[a-z\d_]+:[a-z\d_]+$/i.test(r.texture))throw Error('Use library:texture for a sprite.');number(r.width,.01,width,'sprite width');number(r.height,.01,640,'sprite height');color(r.color);break;
          case 'binding':
            string(r.key, 64, 'binding key'); if (!r.key) throw Error('Binding key is empty.');
            if (r.text != null) string(r.text, 2048, 'binding text');
            if (r.color != null) color(r.color);
            if (r.width != null) number(r.width, 0.01, 640, 'binding width');
            if(r.controls!=null)buttons(r.controls);
            break;
          case 'section': string(r.key, 64, 'section key'); rows(r.rows, width, depth + 1); break;
          case 'transform':if(r.name!=null){string(r.name,128,'layer name');if(new TextEncoder().encode(r.name).length>128)throw Error('Layer name is too long.');}for(const k of ['hidden','locked'])if(r[k]!=null&&typeof r[k]!=='boolean')throw Error('Invalid layer '+k);number(r.x,-640,640,'X offset');number(r.y,-480,480,'Y offset');number(r.scale_x,.1,4,'horizontal scale');number(r.scale_y,.1,4,'vertical scale');if(r.width!=null)number(r.width,.01,640,'content width');rows(r.rows,r.width??width,depth+1);break;
          case 'columns': {
            const lw = r.left_width === 0 ? (width - 24) / 2 : r.left_width;
            number(lw, 0.01, width - 24.01, 'left column width');
            rows(r.left, lw, depth + 1); rows(r.right, width - lw - 24, depth + 1); break;
          }
          case 'buttons':
            if (!Array.isArray(r.buttons) || r.buttons.length < 1 || r.buttons.length > 8) throw Error('Use 1–8 buttons in a row.');
            if (r.width != null) number(r.width, 0.01, width, 'button group width');
            buttons(r.buttons);if(r.buttons.some(b=>b.slot!=null))throw Error('Slots belong to live binding overrides.');
            break;
          default: throw Error(`Unknown row type: ${r.type}`);
        }
      }
    }
    const names = Object.keys(doc.screens);
    if (!names.length || names.length > 64) throw Error('Use 1–64 screens.');
    for(const name of (root.OPEN_MP_EDITOR ? [] : [...(root.UI_VOCABULARY?.screens || []),'Confirmation']))if(!Object.hasOwn(doc.screens,name))throw Error(`Missing server screen: ${name}`);
    for (const [name, screen] of Object.entries(doc.screens)) {
      allowed(screen,['native','title','width','compact','scale','placement','rows','samples']);
      if(screen.native!=null&&typeof screen.native!=='boolean')throw Error('Invalid native canvas flag.');
      if(screen.scale!=null)number(screen.scale,.1,4,'panel scale');
      string(name, 64, 'screen name'); string(screen.title, 512, 'title'); number(screen.width, 0.01, 640, 'content width');
      if (typeof screen.compact !== 'boolean') throw Error('Choose a screen style.');
      if (!screen.placement || !['at', 'center', 'top'].includes(screen.placement.kind)) throw Error('Invalid placement.');
      allowed(screen.placement,screen.placement.kind==='at'?['kind','x','y']:['kind']);
      if (screen.placement.kind === 'at') { number(screen.placement.x, 0, 640, 'X'); number(screen.placement.y, 0, 480, 'Y'); }
      rows(screen.rows, screen.width, 0);
      if (screen.samples != null && (typeof screen.samples !== 'object' || Array.isArray(screen.samples))) throw Error('Preview data must be an object.');
    }
    return doc;
  }
  function resolve(screen) {
    const samples = screen.samples || {}, hidden = (samples._hidden_actions || []).map(key), disabled = (samples._disabled_actions || []).map(key), labels = samples._labels || {},values=samples._variables || {};
    const state=values['ui.state']||'default';
    const offered=interactionChoices(screen);
    const interactive=b=>{if(!b.on_click)return b;const target=offered.find(c=>c.target.kind===b.on_click.kind&&(c.target.kind==='binding'?c.target.key===b.on_click.key&&c.target.slot===b.on_click.slot:key(c.target.action)===key(b.on_click.action)))?.button;return {...b,action:target?.action||b.action,enabled:b.enabled!==false&&!!target&&target.enabled!==false};};
    function override(rs, binding) {
      return rs.map(r => {
        if (r.type === 'text') { if (binding.text != null) r.text = formatText(binding.text,values).replaceAll('{text}', r.text); if (binding.color) r.color = binding.color; }
        if (r.type === 'buttons') {
          if (binding.width != null) r.width = binding.width;
          for (const b of r.buttons) {
            if (binding.text != null) b.label = formatText(binding.text,values).replaceAll('{text}', b.label);
            if (binding.primary != null) b.primary = binding.primary;
            if (binding.background != null) b.background = binding.background;
          }
        }
        if (r.type === 'columns') { r.left = override(r.left, binding); r.right = override(r.right, binding); }
        if(r.type==='transform')r.rows=override(r.rows,binding);
        return r;
      });
    }
    function expand(rs, path) {
      return rs.flatMap((r, i) => {
        const source = [...path, i];if(r.hidden)return [];
        if (r.type === 'binding') {
          const fixture = samples[r.key];
          if (!Array.isArray(fixture)) return [];
          let slot=0;
          function controls(rs){return rs.map(v=>{
            const result={...v,source};
            if(v.type==='buttons')result.buttons=v.buttons.map(b=>{
              const currentSlot=slot++,i=(r.controls||[]).findIndex(c=>c.slot!=null?c.slot===currentSlot:key(c.action)===key(b.action)),def=r.controls?.[i];
              return {...b,...(def||{}),action:b.action,enabled:b.enabled!==false&&def?.enabled!==false,label:def?formatText(def.label,{...values,'button.caption':b.label}).replaceAll('{label}',b.label):b.label,source:i<0?source:[...source,'controls',i],control:{binding:source,action:b.action,label:b.label,slot:currentSlot}};
            }).filter(b=>!b.hidden).map(b=>interactive(positionedButton(b,state)));
            if(v.type==='columns'){result.left=controls(v.left);result.right=controls(v.right);}
            if(v.type==='transform')result.rows=controls(v.rows);
            return result;
          });}
          return controls(override(clone(fixture),r));
        }
        if (r.type === 'section') return Object.hasOwn(samples, r.key) ? expand(r.rows, [...source, 'rows']) : [];
        if(r.type==='transform')return [{...clone(r),source,rows:expand(r.rows,[...source,'rows'])}];
        if (r.type === 'columns') return [{...clone(r), source, left: expand(r.left, [...source, 'left']), right: expand(r.right, [...source, 'right'])}];
        if (r.type === 'buttons') {
          const bs = r.buttons.map((b,i)=>({...b,source:[...source,'buttons',i]})).filter(b => !b.hidden&&!hidden.includes(key(b.action))).map(b => ({...(samples._styles?.[key(b.action)] || {}),...b, enabled: b.enabled !== false && !disabled.includes(key(b.action)), label: formatText(b.label,{...values,'button.caption':labels[key(b.action)]||key(b.action)}).replaceAll('{label}', labels[key(b.action)] || (b.label.includes('{label}') ? key(b.action) : b.label))}));
          return bs.length ? [{...clone(r), buttons: bs.map(b=>interactive(positionedButton(b,state))), source}] : [];
        }
        return [{...clone(r), ...(r.type==='text'?{text:formatText(r.text,values)}:{}), source}];
      });
    }
    return expand(screen.rows, []);
  }
  function measure(screen) {
    const rows = resolve(screen), padding = screen.native ? 0 : screen.compact ? 12 : 16, heading = screen.native ? 0 : screen.compact ? 24 : 28;
    function rowHeight(r, w) {
      switch (r.type) {
        case 'native': return 0;
        case 'text': return wrap(r.text, w - (screen.compact ? 10 : 0)).length * 14 + 4;
        case 'buttons': return screen.compact ? 20 : 24;
        case 'rule': return 9;
        case 'gap': return r.height;
        case 'preview': return 94;
        case 'sprite': return r.height + 4;
        case 'transform': return height(r.rows,r.width??w);
        case 'columns': { const lw = r.left_width || (w - 24) / 2; return Math.max(height(r.left, lw), height(r.right, w - lw - 24)); }
        default: throw Error('Invalid preview fixture row.');
      }
    }
    const height = (rs, w) => rs.reduce((total, r) => total + rowHeight(r, w), 0);
    const scale=screen.scale??1,rawWidth=screen.width+padding*2,rawHeight=screen.native?448:padding*2+heading+height(rows,screen.width)-4;
    const w=rawWidth*scale,h=rawHeight*scale;
    const x = screen.placement.kind === 'at' ? screen.placement.x : (640 - w) / 2;
    const y = screen.placement.kind === 'at' ? screen.placement.y : screen.placement.kind === 'center' ? (480 - h) / 2 : 74;
    return {rows, padding, heading, x, y, width:w,height:h,rawWidth,rawHeight,scale,rowHeight};
  }
  function plan(screen) {
    const m = measure(screen), shapes = [], hits = [], issues = [], p = m.padding, inset = screen.compact ? 5 : 0;
    let widgets = screen.native?0:4, currentPath = null;
    const rect = (x, y, w, h, color) => shapes.push({kind:'rect', x, y, w, h, color,path:currentPath});
    function heart(x,y,color){for(const [dx,dy,w,h]of [[1,0,2,1],[4,0,2,1],[0,1,7,2],[1,3,5,1],[2,4,3,1],[3,5,1,1]])rect(x+2+dx*1.4,y+4+dy*1.4,w*1.4,h*1.4,color);shapes.push({kind:'sprite',x,y:y+1,w:14,h:14,texture:'LD_BEAT:cring',color:'#FFFFFF00'});widgets+=7;}
    const label = (text, x, y, font, sx, sy, color, outline = 1) => shapes.push({kind:'text', text:safe(text), x, y, font, sx, sy, color, outline,path:currentPath});
    if(!screen.native){rect(m.x, m.y, m.rawWidth, m.rawHeight, '#000000D9'); rect(m.x, m.y, m.rawWidth, 2, ACCENT);
    label(formatText(screen.title,screen.samples?._variables||{}).replaceAll('{title}', screen.samples?._title || 'Live title'), m.x + p + inset, m.y + p, 3, screen.compact ? .30 : .38, screen.compact ? 1.4 : 1.8, ACCENT, screen.compact ? 1 : 2);
    label('X', m.x + m.rawWidth - p - 12, m.y + p + 2, 2, .2, 1, MUTED);}
    function transform(shape,x,y,dx,dy,sx,sy){shape.x=x+dx+(shape.x-x)*sx;shape.y=y+dy+(shape.y-y)*sy;if(shape.w!=null)shape.w*=sx;if(shape.h!=null)shape.h*=sy;if(shape.sx!=null)shape.sx*=sx;if(shape.sy!=null)shape.sy*=sy;}
    function render(rs, x, y, width) {
      for (const r of rs) {
        const rh = m.rowHeight(r, width);currentPath=r.source;
        if(!['transform','native'].includes(r.type))hits.push({x, y, w:r.type==='sprite'?r.width:r.type==='buttons'?Math.min(r.width??width,width):width, h:r.type==='sprite'?r.height:Math.max(rh,4), path:r.source});
        switch (r.type) {
          case 'native': {const e=r.element;shapes.push({...e,kind:e.kind==='model'?'model':e.kind,texture:e.kind==='sprite'?e.text:undefined,x:x+e.x,y:y+e.y,native:e,path:r.source});hits.push({x:x+e.x,y:y+e.y,w:e.w,h:e.h,path:r.source});widgets++;break;}
          case 'text':
            for (const line of wrap(r.text, width - inset * 2)) { label(line, x + inset, y, 1, .2, 1, r.color); y += 14; widgets++; }
            y += 4; continue;
          case 'rule': rect(x, y + 4, width, 1, '#D6B87955'); widgets++; break;
          case 'gap': break;
          case 'transform': {
            const si=shapes.length,hi=hits.length;render(r.rows,x,y,r.width??width);
            for(const shape of shapes.slice(si))transform(shape,x,y,r.x,r.y,r.scale_x,r.scale_y);
            for(const hit of hits.slice(hi))transform(hit,x,y,r.x,r.y,r.scale_x,r.scale_y);
            const hs=hits.slice(hi);
            if(hs.length){const left=Math.min(...hs.map(h=>h.x)),top=Math.min(...hs.map(h=>h.y)),right=Math.max(...hs.map(h=>h.x+h.w)),bottom=Math.max(...hs.map(h=>h.y+h.h));hits.push({x:left,y:top,w:right-left,h:bottom-top,path:r.source});}
            break;
          }
          case 'preview':
            shapes.push({kind:'model',x,y,w:Math.min(width,212),h:90,model:r.model,path:currentPath}); widgets++;
            issues.push(`Model ${r.model}: a GTA client capture is needed to verify the 3D preview.`); break;
          case 'sprite':
            shapes.push({kind:'sprite',x,y,w:r.width,h:r.height,color:r.color,texture:r.texture,path:currentPath});widgets++;
            if(!root.GAME_SPRITES?.[r.texture] && !['LD_SPAC:white','LD_SPAC:black'].includes(r.texture))issues.push(`Sprite ${r.texture} is not cached for browser preview.`);
            break;
          case 'columns': { const lw = r.left_width || (width - 24) / 2; render(r.left, x, y, lw); render(r.right, x + lw + 24, y, width - lw - 24); break; }
          case 'buttons': {
            const bs = r.buttons, totalWidth = Math.min(r.width ?? width, width), icons = bs.some(b => b.icon), flexible = bs.filter(b => b.width == null).length;
            const available = totalWidth - 4 * (bs.length - 1) - bs.reduce((n,b) => n + (b.width || 0), 0), fw = flexible ? available / flexible : 0;
            if (available < 0 || flexible && fw <= inset * 2) issues.push('Button row is too narrow for its controls.');
            let bx = x;
            for (const b of bs) {
              const bw = b.width ?? fw;currentPath=b.source||r.source;
              hits.push({x:bx,y,w:bw,h:screen.compact?16:20,path:b.source||r.source,button:true,control:b.control});
              if(b.style){
                const si=shapes.length,hit=hits.at(-1),s=b.style,h=s.height??(screen.compact?16:20),px=s.padding_x??inset,py=s.padding_y??(screen.compact?2:0),edge=s.border_width??0;
                const tint=s.text_color||(b.enabled===false||b.icon&&!b.primary?MUTED:b.primary?ACCENT:TEXT);
                if(bw<=2*px||h<=2*py||edge*2>=Math.min(bw,h))issues.push('Button is too narrow for its padding or border.');
                if(b.background!==false){rect(bx,y,bw,h,s.background_color||'#1C2528D9');widgets++;}
                if(edge>0){for(const [dx,dy,w,h2] of [[0,0,bw,edge],[0,h-edge,bw,edge],[0,edge,edge,h-2*edge],[bw-edge,edge,edge,h-2*edge]])rect(bx+dx,y+dy,w,h2,s.border_color||ACCENT);widgets+=4;}
                if(b.icon==='heart')heart(bx,y,tint);
                else{label(b.label,bx+px+(s.text_x??0),y+py+(s.text_y??0),s.font??(b.body?1:2),s.text_scale_x??(screen.compact?.2:.26),s.text_scale_y??(screen.compact?1:1.3),tint,s.outline??1);widgets++;}
                hit.h=h;for(const shape of shapes.slice(si))transform(shape,bx,y,s.x??0,s.y??0,s.scale_x??1,s.scale_y??1);transform(hit,bx,y,s.x??0,s.y??0,s.scale_x??1,s.scale_y??1);
                bx+=bw+4;continue;
              }
              const tint = b.enabled === false ? MUTED : b.primary ? ACCENT : TEXT;
              if (b.icon === 'heart') {
                heart(bx,y,b.enabled!==false&&b.primary?ACCENT:MUTED);
              } else {
                const controlH = screen.compact ? 16 : 20;
                if (b.background !== false) {
                  if(screen.compact && !icons) {rect(bx,y,bw,controlH,'#1C2528D9');widgets++;}
                  else shapes.push({kind:'native_box',x:bx+inset,y:y+(screen.compact?2:0),w:bw-inset*2,sy:screen.compact?1:1.3,color:'#1C2528D9'});
                }
                label(b.label, bx + inset, y + (screen.compact ? 2 : 0), b.body ? 1 : 2, screen.compact ? .2 : .26, screen.compact ? 1 : 1.3, tint);
                widgets++;
                const captionUnits = [...safe(b.label)].length * (screen.compact ? 4.2 : 5.2);
                if (captionUnits > bw - inset*2) issues.push(`Check caption fit: “${b.label}”.`);
              }
              bx += bw + 4;
            }
            break;
          }
        }
        y += rh;
      }
    }
    render(m.rows, m.x + p, m.y + p + m.heading, screen.width);
    if(m.scale!==1){for(const shape of shapes)transform(shape,m.x,m.y,0,0,m.scale,m.scale);for(const hit of hits)transform(hit,m.x,m.y,0,0,m.scale,m.scale);}
    for(const shape of shapes)if(shape.x<0||shape.y<0||shape.x+(shape.w||0)>640||shape.y+(shape.h||0)>480)issues.push('An element extends outside the server canvas.');
    if (!screen.native && m.height > 390) issues.push('Panel exceeds the 390-unit height limit.');
    if (m.x < 0 || m.y < 0 || m.x + m.width > 640 || m.y + m.height > 480) issues.push('Panel extends outside the 640 × 480 canvas.');
    if (widgets > 64) issues.push('Screen exceeds the current 64-widget renderer budget.');
    return {...m, shapes, hits, widgets, issues:[...new Set(issues)]};
  }
  function viewport(baseHeight=448) {
    return {
      width:640,height:baseHeight,
      toPixels:(x,y,w,h)=>({x:x*w/640,y:y*h/baseHeight}),
      toUnits:(x,y,w,h)=>({x:x*640/w,y:y*baseHeight/h}),
      css:r=>({left:`${r.x/640*100}%`,top:`${r.y/baseHeight*100}%`,width:`${(r.w??r.width)/640*100}%`,height:`${(r.h??r.height)/baseHeight*100}%`})
    };
  }
  root.UiDocument = {validate, resolve, measure, plan, wrap, clone, key, viewport, formatValue, formatText, captionTemplate, buttonPosition, setButtonPosition, interactionChoices, TEXT, MUTED, ACCENT};
  if (typeof module !== 'undefined') module.exports = root.UiDocument;
})(globalThis);
