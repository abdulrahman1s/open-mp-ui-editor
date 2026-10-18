/* Inline completion owns token ranges, filtering, keyboard navigation and popup lifetime. */
(function(root){
  'use strict';
  function tokenAt(value,start,end=start){
    if(start!==end)return null;
    const prefix=value.slice(0,start),match=/\{\{([^{}\n]*)$/.exec(prefix);
    if(!match)return null;
    const close=value.indexOf('}}',start),tail=value.slice(start,close<0?start:close);
    return {start:match.index,end:close>=0&&!/[{}\n]/.test(tail)?close+2:start,query:match[1]};
  }
  function suggestions(variables,query=''){
    const [name,format]=query.split('|'),words=name.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return variables.filter(v=>words.every(word=>(v.key+' '+v.label+' '+v.group).toLowerCase().includes(word)))
      .sort((a,b)=>Number(b.key.startsWith(name.trim()))-Number(a.key.startsWith(name.trim()))||a.label.localeCompare(b.label))
      .map(v=>{const chosen=format?.trim(),known=['text','money','number','integer','decimal1','decimal2','upper','lower','on_off','yes_no'],f=known.find(f=>chosen&&f.startsWith(chosen))||v.format;return {...v,token:'{{'+v.key+(f&&f!=='text'?'|'+f:'')+'}}'};});
  }
  root.UiTextVariables={tokenAt,suggestions};if(typeof module!=='undefined')module.exports=root.UiTextVariables;
})(globalThis);
