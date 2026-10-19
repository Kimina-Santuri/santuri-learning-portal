// Shrinks photos in the browser before upload so storage holds web-sized images.
// JPEG, PNG and WebP images larger than the box are scaled down (never up) and re-encoded
// as WebP, or JPEG where the browser cannot encode WebP. Anything else is returned unchanged,
// as is an image that would not get smaller.
const RESIZABLE=['image/jpeg','image/png','image/webp'];

export async function shrinkImage(file,{maxWidth,maxHeight,quality=.82}){
 if(!file||!RESIZABLE.includes(file.type)||typeof createImageBitmap!=='function')return file;
 let bitmap;
 try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});}catch{return file;}
 const scale=Math.min(1,maxWidth/bitmap.width,maxHeight/bitmap.height);
 const width=Math.round(bitmap.width*scale),height=Math.round(bitmap.height*scale);
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const context=canvas.getContext('2d');
 // Transparent PNGs become JPEG on some browsers; give them a white background rather than black.
 context.fillStyle='#fff';context.fillRect(0,0,width,height);
 context.drawImage(bitmap,0,0,width,height);bitmap.close?.();
 let blob=await new Promise(done=>canvas.toBlob(done,'image/webp',quality));
 if(!blob||blob.type!=='image/webp')blob=await new Promise(done=>canvas.toBlob(done,'image/jpeg',quality));
 if(!blob||(scale===1&&blob.size>=file.size))return file;
 const extension=blob.type==='image/webp'?'webp':'jpg';
 return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.'+extension,{type:blob.type,lastModified:Date.now()});
}

export const megabytes=bytes=>`${(bytes/1048576).toFixed(bytes<1048576?2:1)} MB`;
