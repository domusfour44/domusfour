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
  const product={id:'test',name:'Test',category:'santi',price:14.99,image:'assets/img/sanGennaroOro.jpeg',active:true};
  assert.equal(validateProduct(product).price,14.99);
  for(const data of [{price:-1},{price:1.001},{price:'12'},{category:'invalid&query'},{category:'maschere'},{category:'fortuna'},{image:'assets/img/old.svg'},{image:'https://example.test/old.SVG?v=1'},{image:'javascript:alert(1)'},{purchase_url:'javascript:alert(1)'},{id:'bad&query'}]) assert.throws(()=>validateProduct({...product,...data}));
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
  const previousSegment = process.env.RESEND_SEGMENT_ID;
  process.env.RESEND_SEGMENT_ID = '44444444-4444-4444-8444-444444444444';
  const calls = [];
  const consentRecords = [];
  process.env.SUPABASE_URL = 'https://database.example.test';
  process.env.SUPABASE_SECRET_KEY = 'test-server-key';
  process.env.RESEND_API_KEY = 'test-resend-key';
  process.env.RESEND_FROM = 'Domus <domusfour44@domusfour.it>';
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).startsWith(base)) return originalFetch(url, options);
    calls.push({ url: String(url), ...options });
    if (String(url).includes('/newsletter_consents')) {
      if (options.method === 'POST') consentRecords.push({ ...JSON.parse(options.body), synced: false });
      if (options.method === 'PATCH') consentRecords[0].synced = true;
      return new Response(JSON.stringify(consentRecords),{status:200,headers:{'Content-Type':'application/json'}});
    }
    if (String(url).includes('/categories?')) return new Response(JSON.stringify([{id:'santi',name:'Santi'}]),{status:200,headers:{'Content-Type':'application/json'}});
    return new Response(JSON.stringify(String(url).includes('resend.com') ? {id:'test'} : [
      {id:'test',name:'Test',category:'santi',image:'assets/img/sanGennaroOro.jpeg',price:12.99},
      {id:'pulcinella',category:'maschere',image:'assets/img/pulcinella.svg'},
      {id:'gennaro-patrono',category:'santi',image:'assets/img/gennaro-patrono.svg'},
      {id:'old-fortuna',category:'fortuna',image:'assets/img/photo.jpeg'}
    ]), {status:200,headers:{'Content-Type':'application/json'}});
  };
  try {
    const catalog = await fetch(base+'/api/products');
    assert.equal(catalog.status,200);
    assert.deepEqual((await catalog.json()).map(p => p.id),['test']);
    assert.match(calls.at(-1).url,/active=eq.true/);
    const login=await fetch(base+'/api/admin/login',{method:'POST',headers:{Origin:base},body:JSON.stringify({email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD})});
    const headers={Origin:base,Cookie:login.headers.get('set-cookie').split(';')[0]};
    const product={id:'test',name:'Test',category:'santi',price:12.99,image:'assets/img/sanGennaroOro.jpeg',active:true};
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
    assert.equal(email.subject,'Conferma la tua iscrizione · DomusFour');
    assert.match(email.html,/Conferma iscrizione/);
    assert.match(email.html,/#fbf9f4/);
    assert.doesNotMatch(email.html,/<script|<img|fonts\.googleapis/i);
    const link=/https?:\/\/\S+/.exec(email.text)[0];
    const token=new URL(link).searchParams.get('token');
    const confirmation=await fetch(base+'/api/newsletter/confirm',{method:'POST',headers:{Origin:base},body:JSON.stringify({token})});
    assert.equal(confirmation.status,200);
    assert.equal(calls.filter(c => /\/contacts$/.test(c.url)).length,1);
    const contact = JSON.parse(calls.find(c => /\/contacts$/.test(c.url)).body);
    assert.deepEqual(contact.segments,[{id:process.env.RESEND_SEGMENT_ID}]);
    assert.equal(consentRecords[0].email,'test@example.test');
    assert.equal(consentRecords[0].privacy_version,'2026-10-25');
    assert.equal(consentRecords[0].synced,true);
    assert.equal('ip' in consentRecords[0],false);
    const repeated=await fetch(base+'/api/newsletter/confirm',{method:'POST',headers:{Origin:base},body:JSON.stringify({token})});
    assert.equal(repeated.status,200);
    assert.equal(calls.filter(c => /\/contacts$/.test(c.url)).length,1);
  } finally { globalThis.fetch = originalFetch; if (previousSegment === undefined) delete process.env.RESEND_SEGMENT_ID; else process.env.RESEND_SEGMENT_ID = previousSegment; }
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
test('tickets are saved once, emailed, managed privately and survive notification failures', async () => {
  const originalFetch = globalThis.fetch;
  process.env.TELEGRAM_BOT_TOKEN = 'test-token'; process.env.TELEGRAM_CHAT_ID = 'test-chat';
  const tickets=[], calls=[];
  let emailOk=true, telegramOk=true, databaseOk=true;
  globalThis.fetch=async(url,options={})=>{
    if(String(url).startsWith(base))return originalFetch(url,options);
    calls.push({url:String(url),...options});
    const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
    if(String(url).includes('/rest/v1/contact_tickets')){
      if(!databaseOk)return reply({code:'unavailable'},503);
      const target=new URL(url);
      if(options.method==='POST'){
        const input=JSON.parse(options.body);
        if(tickets.some(t=>t.request_key===input.request_key))return reply([]);
        const ticket={...input,id:'00000000-0000-4000-8000-'+String(tickets.length+1).padStart(12,'0'),ticket_number:tickets.length+1,status:'new',email_status:'pending',telegram_status:'pending',created_at:new Date().toISOString()};
        tickets.push(ticket);return reply([ticket],201);
      }
      const rows=tickets.filter(t=>(!target.searchParams.has('id')||t.id===target.searchParams.get('id').slice(3))&&(!target.searchParams.has('request_key')||t.request_key===target.searchParams.get('request_key').slice(3)));
      if(options.method==='PATCH'){for(const row of rows)Object.assign(row,JSON.parse(options.body));}
      return reply(rows);
    }
    if(String(url).includes('api.resend.com'))return reply(emailOk?{id:'email-id'}:{error:'failed'},emailOk?200:502);
    if(String(url).includes('api.telegram.org'))return reply({ok:telegramOk},telegramOk?200:502);
    throw new Error('Unexpected request');
  };
  const data={nome:'Mario',email:'mario@example.test',motivo:'pezzo',messaggio:'Contenuto <test> con accenti: città',request_key:'11111111-1111-4111-8111-111111111111'};
  const submit=payload=>fetch(base+'/api/contact',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(payload)});
  try{
    const first=await submit(data);assert.equal(first.status,200);
    assert.deepEqual(await first.json(),{ok:true,ticket_id:'DF-000001',email_sent:true});
    assert.equal(tickets.length,1);assert.equal(tickets[0].phone,'');
    const mail=calls.find(c=>c.url.endsWith('/emails'));
    const content=JSON.parse(mail.body);assert.deepEqual(content.to,[data.email]);assert.match(content.subject,/DF-000001/);assert.match(content.text,/Contenuto <test>/);assert.match(content.text,/non una risposta/);
    assert.equal(mail.headers['Idempotency-Key'],'ticket-receipt/'+tickets[0].id);
    assert.equal(content.html,undefined);
    const telegram=JSON.parse(calls.find(c=>c.url.includes('api.telegram.org')).body);assert.match(telegram.text,/DF-000001/);assert.match(telegram.text,/Telefono: Non indicato/);
    assert.equal((await submit(data)).status,200);assert.equal(tickets.length,1);assert.equal(calls.filter(c=>c.url.endsWith('/emails')).length,1);
    emailOk=false;telegramOk=false;
    const second=await submit({...data,request_key:'22222222-2222-4222-8222-222222222222'});assert.equal(second.status,200);assert.deepEqual(await second.json(),{ok:true,ticket_id:'DF-000002',email_sent:false});
    assert.equal(tickets[1].email_status,'failed');assert.equal(tickets[1].telegram_status,'failed');
    assert.equal((await fetch(base+'/api/admin/tickets')).status,401);
    const login=await fetch(base+'/api/admin/login',{method:'POST',headers:{Origin:base},body:JSON.stringify({email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD})});
    const headers={Origin:base,Cookie:login.headers.get('set-cookie').split(';')[0]};
    assert.equal((await (await fetch(base+'/api/admin/tickets',{headers})).json()).length,2);
    const endpoint=base+'/api/admin/tickets/'+tickets[1].id;
    assert.equal((await fetch(endpoint+'/receipt',{method:'POST',headers:{Origin:base}})).status,401);
    assert.equal((await fetch(endpoint,{method:'PATCH',headers:{Origin:'https://other.test',Cookie:headers.Cookie},body:JSON.stringify({status:'closed'})})).status,403);
    assert.equal((await fetch(endpoint,{method:'PATCH',headers,body:JSON.stringify({status:'in_progress'})})).status,200);assert.equal(tickets[1].status,'in_progress');
    assert.equal((await fetch(endpoint,{method:'PATCH',headers,body:JSON.stringify({status:'bad'})})).status,400);
    emailOk=true;
    assert.equal((await fetch(endpoint+'/receipt',{method:'POST',headers})).status,200);assert.equal(tickets[1].email_status,'sent');
    databaseOk=false;
    const failed=await submit({...data,request_key:'33333333-3333-4333-8333-333333333333'});assert.equal(failed.status,502);assert.equal(tickets.length,2);
  }finally{globalThis.fetch=originalFetch;delete process.env.TELEGRAM_BOT_TOKEN;delete process.env.TELEGRAM_CHAT_ID;}
});

test('categories persist, reject duplicates and validate product assignments behind admin access', async () => {
  assert.equal((await fetch(base+'/api/admin/categories')).status,401);
  assert.equal((await fetch(base+'/api/admin/categories',{method:'POST',headers:{Origin:'https://other.test'},body:'{}'})).status,403);
  const login = await fetch(base+'/api/admin/login',{method:'POST',headers:{Origin:base},body:JSON.stringify({email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD})});
  const headers = {Origin:base,Cookie:login.headers.get('set-cookie').split(';')[0]};
  const originalFetch = globalThis.fetch;
  const categories = [{id:'santi',name:'Santi',active:true}];
  const products = [];
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).startsWith(base)) return originalFetch(url,options);
    const target = new URL(url);
    const reply = (data,status=200) => new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
    if (target.pathname === '/rest/v1/categories') {
      if (options.method === 'POST') {
        const category = JSON.parse(options.body);
        if (categories.some(c => c.id === category.id || c.name.toLowerCase() === category.name.toLowerCase())) return reply({code:'23505'},409);
        categories.push(category); return reply([category],201);
      }
      const filter = target.searchParams.get('id');
      return reply(filter ? categories.filter(c => c.id === filter.slice(3) && c.active) : categories);
    }
    if (target.pathname === '/rest/v1/products') {
      if (options.method === 'POST') { const product=JSON.parse(options.body); products.push(product); return reply([product],201); }
      return reply(products.map(p => ({...p,category_info:{name:categories.find(c => c.id === p.category).name}})));
    }
    throw new Error('Unexpected remote request');
  };
  try {
    const create = data => fetch(base+'/api/admin/categories',{method:'POST',headers,body:JSON.stringify(data)});
    const response = await create({name:'  San   Valentino  '});
    assert.equal(response.status,201);
    assert.deepEqual(await response.json(),[{id:'san-valentino',name:'San Valentino',active:true}]);
    assert.equal((await create({name:'San Valentino'})).status,409);
    assert.equal((await create({name:'  '})).status,400);
    assert.equal((await create({name:'Maschere'})).status,400);
    const saved = await fetch(base+'/api/admin/categories',{headers});
    assert.equal((await saved.json()).some(c => c.id === 'san-valentino'),true);
    const product = {id:'cuore',name:'Cuore',category:'san-valentino',price:19.99,image:'assets/img/sanGennaroOro.jpeg',active:true,featured:true};
    assert.equal((await fetch(base+'/api/admin/products',{method:'POST',headers,body:JSON.stringify(product)})).status,201);
    assert.equal((await fetch(base+'/api/products')).status,200);
    const catalog = await (await fetch(base+'/api/products')).json();
    assert.equal(catalog[0].category_info.name,'San Valentino');
    assert.equal(catalog[0].category,'san-valentino');
    const invalid = await fetch(base+'/api/admin/products',{method:'POST',headers,body:JSON.stringify({...product,id:'unknown',category:'missing-category'})});
    assert.equal(invalid.status,400);
    assert.equal(products.length,1);
  } finally { globalThis.fetch = originalFetch; }
});
test('newsletter segment failure leaves the opt-in retryable without marking it synced', async () => {
  const originalFetch = globalThis.fetch;
  const oldSegment = process.env.RESEND_SEGMENT_ID;
  process.env.RESEND_SEGMENT_ID = '55555555-5555-4555-8555-555555555555';
  let receipt, synced = false, available = false, contactCalls = 0;
  const records = [];
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).startsWith(base)) return originalFetch(url,options);
    const reply = (data,status=200) => new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
    if (String(url).endsWith('/emails')) { receipt = JSON.parse(options.body); return reply({id:'email'}); }
    if (String(url).includes('/newsletter_consents')) {
      if (options.method === 'POST') records.push({...JSON.parse(options.body),synced:false});
      if (options.method === 'PATCH') { synced = true; records[0].synced = true; }
      return reply(records);
    }
    if (String(url).endsWith('/contacts')) {
      contactCalls++;
      assert.deepEqual(JSON.parse(options.body).segments,[{id:process.env.RESEND_SEGMENT_ID}]);
      return available ? reply({id:'contact'}) : reply({error:'Segment unavailable'},502);
    }
    throw new Error('Unexpected request');
  };
  try {
    const post = data => ({method:'POST',headers:{Origin:base},body:JSON.stringify(data)});
    assert.equal((await fetch(base+'/api/newsletter',post({email:'segment@example.test',consent:true}))).status,200);
    assert.equal(contactCalls,0);
    const token = new URL(/https?:\/\/\S+/.exec(receipt.text)[0]).searchParams.get('token');
    assert.equal((await fetch(base+'/api/newsletter/confirm',post({token}))).status,502);
    assert.equal(synced,false);
    available = true;
    assert.equal((await fetch(base+'/api/newsletter/confirm',post({token}))).status,200);
    assert.equal(synced,true);
    assert.equal(records.length,1);
    assert.equal((await fetch(base+'/api/newsletter/confirm',post({token}))).status,200);
    assert.equal(contactCalls,2);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldSegment === undefined) delete process.env.RESEND_SEGMENT_ID; else process.env.RESEND_SEGMENT_ID = oldSegment;
  }
});
