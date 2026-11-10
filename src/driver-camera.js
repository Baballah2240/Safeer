/** Local-only QR camera. No frames, credentials or device IDs are uploaded or persisted. */
export class DriverCamera {
 constructor({onCode,onState,environment=globalThis}){
  this.env=environment;this.onCode=onCode;this.onState=onState;this.stream=null;this.video=null;this.frame=null;this.generation=0;this.pending=null;this.paused=false;this.torch=false;this.torchSupported=false;this.lastCode='';this.emptyFrames=0;this.cooldownUntil=0;
  this.lifecycle=()=>{if(!this.env.document||this.env.document.hidden)this.stop('paused');};
  this.env.document?.addEventListener('visibilitychange',this.lifecycle);this.pagehide=()=>this.stop('paused');this.env.addEventListener?.('pagehide',this.pagehide);this.env.addEventListener?.('safeer:native-pause',this.pagehide);
 }
 emit(state){this.state=state;this.onState?.({...state,torch:this.torch,torchSupported:this.torchSupported});}
 attach(video,frame){if(this.video&&this.video!==video)this.video.srcObject=null;this.video=video;this.frame=frame;if(video&&this.stream){video.srcObject=this.stream;void video.play().catch(()=>this.stop('paused'));}}
 start(){if(this.stream){this.paused=false;return Promise.resolve(true);}if(this.pending)return this.pending;const gen=++this.generation;const task=this.begin(gen).finally(()=>{if(this.pending===task)this.pending=null;});this.pending=task;return task;}
 async begin(gen){
  this.emit({status:'starting'});
  try{
   const installed=/SafeerApp\/(\d+) \((driver|booking)\)/.exec(this.env.navigator?.userAgent||'');
   if(installed&&installed[2]!=='driver')throw Error('CAMERA_DRIVER_APP_REQUIRED');
   if(installed&&Number(installed[1])<18000)throw Error('CAMERA_APP_UPDATE_REQUIRED');
   if(this.env.isSecureContext===false||!this.env.navigator?.mediaDevices?.getUserMedia)throw Error('CAMERA_UNAVAILABLE');
   this.detector=null;
   if(this.env.BarcodeDetector)try{const formats=await this.env.BarcodeDetector.getSupportedFormats();if(formats.includes('qr_code'))this.detector=new this.env.BarcodeDetector({formats:['qr_code']});}catch{}
   if(!this.detector&&typeof this.env.jsQR!=='function')throw Error('CAMERA_DECODER_UNAVAILABLE');
   const stream=await this.env.navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});
   if(gen!==this.generation||this.env.document?.hidden){stream.getTracks().forEach(t=>t.stop());return false;}
   this.stream=stream;this.paused=false;this.lastCode='';this.emptyFrames=0;this.torch=false;this.torchSupported=stream.getVideoTracks()[0]?.getCapabilities?.().torch===true;
   if(!this.video)throw Error('CAMERA_UNAVAILABLE');this.video.srcObject=stream;await this.video.play();
   if(gen!==this.generation)return false;this.canvas=this.env.document.createElement('canvas');this.context=this.canvas.getContext('2d',{willReadFrequently:true});if(!this.context)throw Error('CAMERA_UNAVAILABLE');this.emit({status:'active'});void this.loop(gen);return true;
  }catch(error){if(gen!==this.generation)return false;this.release();const code=error.message?.startsWith('CAMERA_')?error.message:['NotAllowedError','PermissionDeniedError'].includes(error.name)?'CAMERA_PERMISSION_DENIED':['NotFoundError','DevicesNotFoundError'].includes(error.name)?'CAMERA_NOT_FOUND':'CAMERA_UNAVAILABLE';this.emit({status:'error',code});return false;}
 }
 capture(){
  const video=this.video,frame=this.frame;if(!video||!frame||video.readyState<2||!video.videoWidth||!video.videoHeight)return false;
  const v=video.getBoundingClientRect(),f=frame.getBoundingClientRect();if(!v.width||!v.height||!f.width||!f.height)return false;
  const scale=Math.max(v.width/video.videoWidth,v.height/video.videoHeight),left=(video.videoWidth*scale-v.width)/2,top=(video.videoHeight*scale-v.height)/2;
  const sx=Math.max(0,(f.left-v.left+left)/scale),sy=Math.max(0,(f.top-v.top+top)/scale),sw=Math.min(f.width/scale,video.videoWidth-sx),sh=Math.min(f.height/scale,video.videoHeight-sy),ratio=Math.min(1,560/Math.max(sw,sh));
  this.canvas.width=Math.max(1,Math.round(sw*ratio));this.canvas.height=Math.max(1,Math.round(sh*ratio));this.context.drawImage(video,sx,sy,sw,sh,0,0,this.canvas.width,this.canvas.height);return true;
 }
 async decode(){if(this.detector)try{return(await this.detector.detect(this.canvas))[0]?.rawValue||null;}catch{this.detector=null;}if(typeof this.env.jsQR!=='function')throw Error('CAMERA_DECODER_UNAVAILABLE');const frame=this.context.getImageData(0,0,this.canvas.width,this.canvas.height);return this.env.jsQR(frame.data,frame.width,frame.height,{inversionAttempts:'attemptBoth'})?.data||null;}
 async loop(gen){
  while(gen===this.generation&&this.stream){await new Promise(r=>this.env.setTimeout(r,160));if(gen!==this.generation||!this.stream)return;if(this.paused||Date.now()<this.cooldownUntil)continue;
   try{if(!this.capture())continue;const code=await this.decode();if(gen!==this.generation)return;if(!code){if(++this.emptyFrames>=4)this.lastCode='';continue;}this.emptyFrames=0;if(code===this.lastCode)continue;this.lastCode=code;
    await this.onCode(code);if(gen!==this.generation)return;this.cooldownUntil=Date.now()+850;
   }catch{if(gen===this.generation){this.release();this.emit({status:'error',code:'CAMERA_DECODER_UNAVAILABLE'});}return;}
  }
 }
 setPaused(value){this.paused=Boolean(value);}
 async toggleTorch(){if(!this.stream||!this.torchSupported)return false;try{const next=!this.torch;await this.stream.getVideoTracks()[0].applyConstraints({advanced:[{torch:next}]});this.torch=next;this.emit({status:'active'});return true;}catch{this.torch=false;this.torchSupported=false;this.emit({status:'active',code:'CAMERA_TORCH_UNAVAILABLE'});return false;}}
 release(){if(this.stream)this.stream.getTracks().forEach(t=>t.stop());this.stream=null;if(this.video){this.video.pause?.();this.video.srcObject=null;}this.torch=false;this.torchSupported=false;}
 stop(reason='stopped'){this.generation++;this.release();this.paused=false;this.lastCode='';this.emit({status:reason});}
 destroy(){this.stop();this.env.document?.removeEventListener('visibilitychange',this.lifecycle);this.env.removeEventListener?.('pagehide',this.pagehide);this.env.removeEventListener?.('safeer:native-pause',this.pagehide);}
}
