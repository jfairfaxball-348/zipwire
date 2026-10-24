import {compareWind} from './wind.js';
self.onmessage=e=>{
  if(e.data?.type!=='compare')return;
  try{
    const results=compareWind(e.data.params);
    self.postMessage({type:'done',id:e.data.id,results});
  } catch(error){
    self.postMessage({type:'error',id:e.data.id,message:String(error?.message??error)});
  }
};