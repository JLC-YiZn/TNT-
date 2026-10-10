const fs=require('fs'),vm=require('vm');
function createGame(mode='local',mapType='ruins',mapSeed='TNT-2026'){
  const nodes=new Map(),events={};let frame,time=0,seed=5,canvasSerial=0;
  function node(id){
    if(nodes.has(id))return nodes.get(id);
    const ctx=new Proxy({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:im=>n.image=im,createLinearGradient:()=>({addColorStop(){}})}, {get:(o,k)=>k in o?o[k]:(()=>{})});
    const n={id,style:{},dataset:{},classList:{toggle(){}},value:id==='mode'?mode:id==='mapType'?mapType:id==='mapSeed'?mapSeed:45,checked:false,disabled:false,handlers:{},focus(){},getContext:()=>ctx,setAttribute(){},querySelector:()=>node(id+'small'),addEventListener(k,f){this.handlers[k]=f;},setPointerCapture(){},getBoundingClientRect:()=>({left:0,top:0,width:1200,height:650})};nodes.set(id,n);return n;
  }
  const buttons=[0,1,2].map(i=>{const n=node('weapon'+i);n.dataset.weapon=i;return n;});
  const doc={getElementById:node,createElement:()=>node('buffer'+(++canvasSerial)),querySelectorAll:()=>buttons,addEventListener(k,f){events['doc'+k]=f;}};
  const win={addEventListener:(k,f)=>events[k]=f},math=Object.create(Math);math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const sandbox=vm.createContext({document:doc,window:win,Math:math,Uint8Array,requestAnimationFrame:f=>frame=f,console});
  for(const name of ['world','physics','game'])vm.runInContext(fs.readFileSync('outputs/'+name+'.js','utf8'),sandbox,{filename:name+'.js'});
  function tick(seconds){for(let i=0;i<Math.round(seconds*120);i++){time+=1000/120;frame(time);}}
  tick(1/120);
  function key(type,key,code=key,repeat=false){events[type]({key,code,repeat,preventDefault(){},target:{matches:()=>false}});}
  const state=()=>win.TNT.getState(),click=id=>node(id).onclick();
  function shoot(seconds=1){key('keydown',' ','Space');tick(seconds);key('keyup',' ','Space');}
  return {state,node,click,tick,key,shoot,reset:win.TNT.reset,buttons,events,api:win.TNT,worlds:win.TNTWorld,physics:win.TNTPhysics,pixel:(x,y)=>nodes.get('buffer1').image.data[(y*1200+x)*4+3]};
}
module.exports={createGame};
