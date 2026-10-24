export function createGameRenderer(canvas,Renderer,{antialias=true,reduced=false}={}){
  const attempts=[],profiles=reduced
    ? [{antialias:false,powerPreference:'default'},{antialias:false,powerPreference:'low-power'}]
    : [{antialias,powerPreference:'high-performance'},{antialias:false,powerPreference:'default'},{antialias:false,powerPreference:'low-power'}];
  let reason='';const creationError=e=>{reason=e.statusMessage||'WebGL2 unavailable';};
  canvas.addEventListener('webglcontextcreationerror',creationError);
  try{
    // Reserve only a tiny drawing buffer before the device's GPU profile is known.
    canvas.width=canvas.height=1;
    for(let i=0;i<profiles.length;i++){
      const attributes={...profiles[i],alpha:false,depth:true,stencil:false,preserveDrawingBuffer:false,failIfMajorPerformanceCaveat:false};
      let context;try{context=canvas.getContext('webgl2',attributes);}catch(error){reason=error.message;}
      attempts.push({...profiles[i],message:context?'ok':reason||'No WebGL2 context'});
      if(!context)continue;
      try{
        const renderer=new Renderer({canvas,context,...attributes});
        renderer.userData??={};renderer.userData.gpuFallback=i>0;
        canvas.dataset.gpuProfile=reduced||i>0?'compatible':'standard';
        return renderer;
      }catch(error){context.getExtension('WEBGL_lose_context')?.loseContext();throw error;}
    }
    const error=new Error('WebGL2のコンテキストを作成できませんでした。');error.code='WEBGL_UNAVAILABLE';error.attempts=attempts;throw error;
  }finally{canvas.removeEventListener('webglcontextcreationerror',creationError);}
}
