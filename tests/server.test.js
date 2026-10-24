import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
process.env.NODE_ENV = 'test';
process.env.ADMIN_EMAIL = 'admin@example.test';
process.env.ADMIN_PASSWORD = 'a-long-test-password-only';
process.env.SESSION_SECRET = 'test-secret-with-more-than-32-characters';
process.env.ALLOWED_ORIGINS = 'https://legacy.example.test';
const { server } = await import('../server/index.js');
const { validateProduct } = await import('../server/services.js');
let base;
before(async () => { await new Promise(resolve => server.listen(0,'127.0.0.1',resolve)); base = `http://127.0.0.1:${server.address().port}`; process.env.SITE_URL=base; });
after(() => new Promise(resolve => server.close(resolve)));
test('admin routes require session, reject cross-origin requests, accept login and logout', async () => {
  assert.equal((await fetch(base+'/api/admin/products')).status,401);
  assert.equal((await fetch(base+'/api/admin/login',{method:'POST',headers:{Origin:'https://other.test'}})).status,403);
  const response=await fetch(base+'/api/admin/login',{method:'POST',headers:{Origin:base},body:JSON.stringify({email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD})});
  assert.equal(response.status,200);
  const cookie=response.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(base+'/api/admin/session',{headers:{Cookie:cookie}})).status,200);
  assert.equal((await fetch(base+'/api/admin/session',{headers:{Cookie:cookie+'tampered'}})).status,401);
  const logout=await fetch(base+'/api/admin/logout',{method:'POST',headers:{Origin:base,Cookie:cookie}});
  assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
});
test('product validation rejects unsafe links, malformed prices and category', () => {
  const product={id:'test',name:'Test',category:'santi',price:14.99,image:'assets/img/cornetto.svg',active:true};
  assert.equal(validateProduct(product).price,14.99);
  for(const data of [{price:-1},{price:1.001},{price:'12'},{category:'invalid'},{image:'javascript:alert(1)'},{purchase_url:'javascript:alert(1)'},{id:'bad&query'}]) assert.throws(()=>validateProduct({...product,...data}));
});
test('newsletter rejects missing consent and invalid confirmation', async () => {
  const post=data=>({method:'POST',headers:{Origin:base},body:JSON.stringify(data)});
  assert.equal((await fetch(base+'/api/newsletter',post({email:'test@example.test'}))).status,400);
  assert.equal((await fetch(base+'/api/newsletter/confirm',post({token:'fake'}))).status,400);
});
test('private files and dormant customer authentication are not served', async () => {
  for(const path of ['/.env','/server/index.js','/future-auth/login.html']) assert.equal((await fetch(base+path)).status,404);
  assert.equal((await fetch(base+'/admin.html')).status,200);
});
test('catalog and CRUD forward validated data to Supabase; newsletter waits for confirmation', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  process.env.SUPABASE_URL = 'https://database.example.test';
  process.env.SUPABASE_SECRET_KEY = 'test-server-key';
  process.env.RESEND_API_KEY = 'test-resend-key';
  process.env.RESEND_FROM = 'Domus <domusfour44@domusfour.it>';
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).startsWith(base)) return originalFetch(url, options);
    calls.push({ url: String(url), ...options });
    return new Response(JSON.stringify(String(url).includes('resend.com') ? {id:'test'} : [{id:'test',price:12.99}]), {status:200,headers:{'Content-Type':'application/json'}});
  };
  try {
    assert.equal((await fetch(base+'/api/products')).status,200);
    assert.match(calls.at(-1).url,/active=eq.true/);
    const login=await fetch(base+'/api/admin/login',{method:'POST',headers:{Origin:base},body:JSON.stringify({email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD})});
    const headers={Origin:base,Cookie:login.headers.get('set-cookie').split(';')[0]};
    const product={id:'test',name:'Test',category:'santi',price:12.99,image:'assets/img/cornetto.svg',active:true};
    assert.equal((await fetch(base+'/api/admin/products',{method:'POST',headers,body:JSON.stringify(product)})).status,201);
    assert.equal(JSON.parse(calls.at(-1).body).price,12.99);
    assert.equal((await fetch(base+'/api/admin/products/test',{method:'PUT',headers,body:JSON.stringify({...product,price:15.50})})).status,200);
    assert.equal(calls.at(-1).method,'PATCH');
    assert.equal((await fetch(base+'/api/admin/products/test',{method:'DELETE',headers})).status,200);
    assert.equal(calls.at(-1).method,'DELETE');
    const start=calls.length;
    const signup=await fetch(base+'/api/newsletter',{method:'POST',headers:{Origin:base},body:JSON.stringify({email:'test@example.test',consent:true})});
    assert.equal(signup.status,200);
    assert.equal(calls.length,start+1);
    assert.match(calls.at(-1).url,/\/emails$/);
    const email=JSON.parse(calls.at(-1).body);
    const link=/https?:\/\/\S+/.exec(email.text)[0];
    const token=new URL(link).searchParams.get('token');
    const confirmation=await fetch(base+'/api/newsletter/confirm',{method:'POST',headers:{Origin:base},body:JSON.stringify({token})});
    assert.equal(confirmation.status,200);
    assert.match(calls.at(-1).url,/\/contacts$/);
  } finally { globalThis.fetch = originalFetch; }
});
test('legacy contact CORS remains limited to contacts and health stays available', async () => {
  assert.equal((await fetch(base+'/health')).status,200);
  const preflight = await fetch(base+'/api/contact',{method:'OPTIONS',headers:{Origin:'https://legacy.example.test','Access-Control-Request-Method':'POST'}});
  assert.equal(preflight.status,204);
  assert.equal(preflight.headers.get('access-control-allow-origin'),'https://legacy.example.test');
  assert.equal((await fetch(base+'/api/contact',{method:'OPTIONS',headers:{Origin:'https://other.test'}})).status,403);
  assert.equal((await fetch(base+'/api/contact')).status,405);
  assert.equal((await fetch(base+'/api/admin/login',{method:'POST',headers:{Origin:'https://legacy.example.test'}})).status,403);
});
test('contact validation blocks invalid submissions before contacting Telegram', async () => {
  const headers = {Origin:base,'Content-Type':'application/json'};
  for (const body of ['{', 'null', '[]', JSON.stringify({nome:'Nome',email:'invalid'}), JSON.stringify({nome:'x'.repeat(101)})]) {
    assert.equal((await fetch(base+'/api/contact',{method:'POST',headers,body})).status,400);
  }
  assert.equal((await fetch(base+'/api/contact',{method:'POST',headers:{Origin:base,'Content-Type':'text/plain'},body:'test'})).status,415);
});
test('integrated contacts preserve Telegram payload, accept both form formats and report upstream errors', async () => {
  const originalFetch = globalThis.fetch;
  const oldToken = process.env.TELEGRAM_BOT_TOKEN, oldChat = process.env.TELEGRAM_CHAT_ID;
  process.env.TELEGRAM_BOT_TOKEN = 'test-token'; process.env.TELEGRAM_CHAT_ID = 'test-chat';
  const calls = [];
  let telegramOk = true;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).startsWith(base)) return originalFetch(url,options);
    calls.push({url:String(url),...options});
    return new Response(JSON.stringify({ok:telegramOk}),{status:telegramOk ? 200 : 502});
  };
  try {
    const data = {nome:'Mario',email:'mario@example.test',numero:'+39 123456',motivo:'pezzo',messaggio:'Informazioni sul prodotto <test>'};
    const json = await fetch(base+'/api/contact',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(data)});
    assert.equal(json.status,200); assert.deepEqual(await json.json(),{ok:true});
    assert.equal(calls.at(-1).url,'https://api.telegram.org/bottest-token/sendMessage');
    const payload = JSON.parse(calls.at(-1).body);
    assert.equal(payload.chat_id,'test-chat');
    assert.match(payload.text,/Pezzo personalizzato/);
    assert.match(payload.text,/Informazioni sul prodotto <test>/);
    assert.equal(payload.parse_mode,undefined);
    const encoded = await fetch(base+'/api/contact',{method:'POST',headers:{Origin:'https://legacy.example.test'},body:new URLSearchParams(data)});
    assert.equal(encoded.status,200);
    telegramOk = false;
    const failed = await fetch(base+'/api/contact',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(data)});
    assert.equal(failed.status,502); assert.equal((await failed.json()).ok,false);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN; else process.env.TELEGRAM_BOT_TOKEN = oldToken;
    if (oldChat === undefined) delete process.env.TELEGRAM_CHAT_ID; else process.env.TELEGRAM_CHAT_ID = oldChat;
  }
});
