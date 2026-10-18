/* Magnetic geometry in the same units as the native render plan. */
(function(root){
  'use strict';
  function snap(moving,targets,{threshold=4,x=true,y=true}={}){
    const result={dx:0,dy:0,lines:[]};
    for(const [axis,size,other,otherSize,enabled]of [['x','w','y','h',x],['y','h','x','w',y]]){
      if(!enabled)continue;let best=null;
      for(const target of targets){
        const anchors=target.centerOnly?[.5]:[0,.5,1];
        for(const a of [0,.5,1])for(const b of anchors){
          // Canvas center only attracts the center of a layer.
          if(target.centerOnly&&a!==.5)continue;
          const position=target[axis]+target[size]*b,delta=position-moving[axis]-moving[size]*a;
          const score=Math.abs(delta)+(a===b?0:.05);
          if(Math.abs(delta)<=threshold&&(!best||score<best.score))best={delta,position,score,target};
        }
      }
      if(best){result[axis==='x'?'dx':'dy']=best.delta;result.lines.push({axis,position:best.position,start:Math.min(moving[other],best.target[other])-8,end:Math.max(moving[other]+moving[otherSize],best.target[other]+best.target[otherSize])+8});}
    }
    return result;
  }
  root.UiGuides={snap};if(typeof module!=='undefined')module.exports=root.UiGuides;
})(globalThis);
