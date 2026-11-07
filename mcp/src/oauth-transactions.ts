/**
 * Keep the OAuth provider's encrypted, browser-bound transactions off KV's
 * eventually consistent cache. Only its transaction: prefix is redirected.
 * Clients, grants and tokens continue using the existing KV namespace.
 */
export function withConsistentOAuthTransactions(env:Env):Env {
  const namespace=env.OAUTH_KV;
  const prefix='transaction:';
  const consume=async(key:string,options?:unknown)=>{
    // DELETE RETURNING runs on D1's primary. It both reads and claims the
    // transaction, so concurrent submissions cannot authorize it twice.
    const row=await env.DB.prepare('DELETE FROM oauth_transactions WHERE key=? AND expires_at>unixepoch() RETURNING value').bind(key).first<{value:string}>();
    if(!row)return null;
    const type=typeof options==='string'?options:options&&typeof options==='object'&&'type' in options?options.type:'text';
    if(type==='json')return JSON.parse(row.value) as unknown;
    if(type==='arrayBuffer')return new TextEncoder().encode(row.value).buffer;
    if(type==='stream')return new Response(row.value).body;
    return row.value;
  };
  const kv=new Proxy(namespace,{
    get(target,property){
      if(property==='get')return (key:unknown,...args:unknown[])=>{
        if(typeof key==='string'&&key.startsWith(prefix))return consume(key,args[0]);
        return Reflect.apply(target.get,target,[key,...args]);
      };
      if(property==='put')return async(key:string,value:unknown,options?:{expiration?:number;expirationTtl?:number})=>{
        if(!key.startsWith(prefix))return Reflect.apply(target.put,target,[key,value,options]);
        // The provider stores its AES-GCM envelope as text, never credentials.
        if(typeof value!=='string')throw new TypeError('OAuth transaction envelope must be text');
        const expires=options?.expiration??Math.floor(Date.now()/1000)+(options?.expirationTtl??600);
        await env.DB.batch([
          env.DB.prepare('DELETE FROM oauth_transactions WHERE expires_at<=unixepoch()'),
          env.DB.prepare('INSERT INTO oauth_transactions(key,value,expires_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,expires_at=excluded.expires_at').bind(key,value,expires),
        ]);
      };
      if(property==='delete')return async(key:string)=>{
        if(!key.startsWith(prefix))return Reflect.apply(target.delete,target,[key]);
        await env.DB.prepare('DELETE FROM oauth_transactions WHERE key=?').bind(key).run();
      };
      const value=Reflect.get(target,property,target);
      return typeof value==='function'?value.bind(target):value;
    },
  });
  return {...env,OAUTH_KV:kv};
}
