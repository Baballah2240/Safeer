import qrcode from 'qrcode-generator';

/** Vector geometry only: no external URL, image request or embedded passenger details. */
export function ticketQr(value:string){
 const code=qrcode(0,'M');code.addData(value);code.make();
 const size=code.getModuleCount();let path='';
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(code.isDark(y,x))path+=`M${x} ${y}h1v1h-1z`;
 return {size,path};
}
