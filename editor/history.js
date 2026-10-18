/* Document history owns grouping, branching and bounded snapshots. */
(function(root){
  'use strict';
  const copy=value=>JSON.parse(JSON.stringify(value));
  function create(initial,{limit=100,saved=null}={}){
    let steps=[{...copy(initial),label:'Opened document'}],index=0,lastKey=null,lastTime=0;
    if(saved?.version===1&&Array.isArray(saved.steps)&&Number.isInteger(saved.index)&&saved.index>=0&&saved.index<saved.steps.length&&saved.steps.length<=limit+1&&saved.steps.every(s=>typeof s?.value==='string'&&s.context&&typeof s.label==='string')&&saved.steps[saved.index].value===initial.value){steps=copy(saved.steps);index=saved.index;}
    const current=()=>copy(steps[index]);
    return {
      capture(context){steps[index].context=copy(context);},
      commit(value,context,{label='Edit layer',mergeKey=null,now=Date.now()}={}){
        if(value===steps[index].value)return false;
        const merge=mergeKey&&mergeKey===lastKey&&now-lastTime<800&&index===steps.length-1&&index>0;
        steps.splice(index+1);
        const step={value,context:copy(context),label};
        if(merge)steps[index]=step;else{steps.push(step);index++;}
        if(steps.length>limit+1){steps.shift();index--;}
        lastKey=mergeKey;lastTime=now;return true;
      },
      jump(next){if(!Number.isInteger(next)||next<0||next>=steps.length)return null;index=next;lastKey=null;return current();},
      undo(){return index>0?this.jump(index-1):null;},
      redo(){return index<steps.length-1?this.jump(index+1):null;},
      reset(value,context){steps=[{value,context:copy(context),label:'Opened document'}];index=0;lastKey=null;},
      breakGroup(){lastKey=null;},
      snapshot({maxBytes=1_500_000}={}){
        const saved={version:1,index,steps:copy(steps)};
        // Keep the current document and nearby undo/redo steps within browser quotas.
        while(saved.steps.length>1&&JSON.stringify(saved).length>maxBytes){
          if(saved.index>0){saved.steps.shift();saved.index--;}else saved.steps.pop();
        }
        return saved;
      },
      get entries(){return steps.map((s,i)=>({label:s.label,index:i,current:i===index,future:i>index}));},
      get undoLabel(){return index>0?steps[index].label:null;},
      get redoLabel(){return steps[index+1]?.label||null;}
    };
  }
  root.UiHistory={create};if(typeof module!=='undefined')module.exports=root.UiHistory;
})(globalThis);
