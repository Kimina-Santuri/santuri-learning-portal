let clientPromise;
// Design preview with sample data: local addresses only, switched on with ?preview and off with ?preview=0.
export const preview=(()=>{
 if(!['127.0.0.1','localhost'].includes(location.hostname))return false;
 const flag=new URLSearchParams(location.search).get('preview');
 try{if(flag!==null)sessionStorage.setItem('santuri-preview',flag==='0'?'':'1');return Boolean(sessionStorage.getItem('santuri-preview'));}catch{return flag!==null&&flag!=='0';}
})();
export function configured() {
  if (preview) return true;
  const c = window.SANTURI_CONFIG;
  return Boolean(c?.accountsEnabled && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(c.supabaseUrl) && c.supabasePublishableKey && !c.supabasePublishableKey.startsWith('sb_secret_'));
}
export async function getClient() {
  if (!configured()) return null;
  if (!clientPromise) clientPromise = preview ? import('./preview-client.js').then(({createClient}) => createClient()) : import('../vendor/supabase.js').then(({createClient}) => createClient(window.SANTURI_CONFIG.supabaseUrl,window.SANTURI_CONFIG.supabasePublishableKey,{auth:{flowType:'pkce',detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}}));
  return clientPromise;
}
export async function result(query) { const {data,error} = await query; if(error) throw error; return data; }
