// Standalone fixture runner for environments that cannot launch Playwright.
// Test-only adapters map localhost URLs to LinkedIn and mock Chrome storage.
import http from 'node:http';
import { readFileSync } from 'node:fs';
const read = name => readFileSync(new URL(`../extension/${name}`, import.meta.url),'utf8');
const card = (who,id,extra='') => `<article class="feed-shared-update-v2" id="${id}"><div class="update-components-actor"><a class="update-components-actor__meta-link" href="https://www.linkedin.com/in/${who}/">${who}</a></div><p>My post about making space for focused work.</p>${extra}<p id="comment-${id}">A thoughtful reply from a reader.</p><div contenteditable="true" role="textbox">Reply here</div></article>`;
const runner = `<!doctype html><html><head><title>LinkedIn Quiet browser checks</title></head><body style="font:16px system-ui;margin:40px"><h1>LinkedIn Quiet browser checks</h1><p id="summary">Running…</p><ol id="results"></ol><iframe title="Extension fixture" style="width:100%;height:600px;border:1px solid #ddd"></iframe><script>
const frame=document.querySelector('iframe');let pass=0,fail=0;
const tick=()=>new Promise(r=>setTimeout(r,120));
async function load(path,kind='posts',slug='example'){frame.src=path+'?kind='+kind+'&slug='+slug;await new Promise(r=>frame.onload=r);await tick();return frame.contentDocument;}
function visible(d,s){const el=d.querySelector(s);return !!el&&d.defaultView.getComputedStyle(el).visibility==='visible'&&el.getClientRects().length>0;}
function check(value,message){if(!value)throw Error(message);}
async function test(name,fn){const li=document.createElement('li');try{await fn();pass++;li.textContent='PASS — '+name;}catch(e){fail++;li.textContent='FAIL — '+name+': '+e.message;}document.querySelector('#results').append(li);}
(async()=>{
await test('Feed stays masked, including own posts',async()=>{const d=await load('/feed/');check(!visible(d,'#own'),'own post leaked');check(!visible(d,'#inbox'),'inbox leaked');});
await test('Own posts and comments visible; other posts hidden',async()=>{const d=await load('/in/example/recent-activity/shares/');check(visible(d,'#own'),'own post missing');check(visible(d,'#comment-own'),'comment missing');check(!visible(d,'#other'),'other post leaked');});
await test('Direct post links verify the author',async()=>{const d=await load('/feed/update/urn:li:activity:123/');check(visible(d,'#own'),'own post missing');check(!visible(d,'#other'),'other leaked');});
await test('Embedded own post cannot reveal an outer repost',async()=>{const d=await load('/in/example/recent-activity/all/','nested');check(!visible(d,'#outer'),'outer leaked');check(!visible(d,'#nested'),'nested leaked');});
await test('Own profile visible; recommendations hidden',async()=>{const d=await load('/in/example/','profile');check(visible(d,'#experience'),'profile missing');check(!visible(d,'#interests'),'interests leaked');check(!visible(d,'aside'),'sidebar leaked');});
await test('Stale profile identity stays masked',async()=>{const d=await load('/in/example/','wrong-profile');check(!visible(d,'#experience'),'stale profile leaked');});
await test('Recycled cards lose ownership immediately',async()=>{const d=await load('/in/example/recent-activity/shares/');d.querySelector('#own a').href='https://www.linkedin.com/in/other/';await tick();check(!visible(d,'#own'),'recycled post leaked');});
await test('SPA navigation revokes approved content',async()=>{const d=await load('/in/example/recent-activity/shares/');d.defaultView.history.pushState({},'','/messaging/');await tick();check(!visible(d,'#own'),'navigation leaked');});
await test('Changing settings revokes old access',async()=>{const d=await load('/in/example/recent-activity/shares/');await d.defaultView.chrome.storage.local.set({profileSlug:'someone'});await tick();check(!visible(d,'#own'),'old profile leaked');});
await test('Unconfigured extension masks everything',async()=>{const d=await load('/feed/','posts','');check(!visible(d,'#own'),'setup leaked');});
await test('Authentication works and masks again when leaving',async()=>{const d=await load('/login');check(visible(d,'#own'),'login hidden');d.defaultView.history.pushState({},'','/feed/');await tick();check(!visible(d,'#own'),'auth exit leaked');});
await test('Default CSS works without JavaScript',async()=>{const d=await load('/feed/','css');check(!visible(d,'#own'),'CSS failed');});
document.querySelector('#summary').textContent=pass+' passed, '+fail+' failed';document.title=pass+' passed, '+fail+' failed — LinkedIn Quiet';await load('/feed/');
})();</script></body></html>`;
const server = http.createServer((req,res)=>{
  const url = new URL(req.url,'http://localhost:8765');
  res.setHeader('Content-Type','text/html; charset=utf-8');
  if(url.pathname==='/'){res.end(runner);return;}
  const kind=url.searchParams.get('kind');
  const slug=url.searchParams.get('slug');
  let content=card('example','own')+card('someone','other','<a href="https://www.linkedin.com/in/example/">Mention of me</a>');
  if(kind==='nested')content=card('someone','outer',card('example','nested'));
  if(kind==='profile'||kind==='wrong-profile')content=`<section class="pv-top-card"><a href="https://www.linkedin.com/in/${kind==='profile'?'example':'someone'}/overlay/photo/">Profile photo</a><h1>Example Person</h1></section><section id="experience">My work and experience</section><section><div id="interests">Recommendations</div></section>`;
  const shim=`const originalPolicy=LinkedInQuietPolicy;const map=v=>String(v).replace(location.origin,'https://www.linkedin.com');window.LinkedInQuietPolicy={profileSlug:v=>originalPolicy.profileSlug(map(v)),route:(v,s)=>originalPolicy.route(map(v),s)};window.listeners=[];window.savedSlug=${JSON.stringify(slug)};window.chrome={storage:{local:{get:async()=>({profileSlug:savedSlug}),set:async v=>{savedSlug=v.profileSlug;listeners.forEach(fn=>fn({profileSlug:{newValue:savedSlug}},'local'));}},onChanged:{addListener:fn=>listeners.push(fn)}}};`;
  res.end(`<!doctype html><html><head><title>LinkedIn fixture</title><style>main{font:16px system-ui}article,section{background:white;padding:30px;margin:20px;border-radius:12px}</style><style>${read('quiet.css')}</style>${kind==='css'?'':`<script>${read('policy.js')}</script><script>${shim}</script><script>${read('content.js')}</script>`}</head><body><header id="global-nav">Navigation</header><div><main>${content}</main><aside>Suggestions</aside></div><div class="msg-overlay-container" id="inbox">Messages</div></body></html>`);
});
server.listen(8765,'127.0.0.1',()=>console.log('Open http://127.0.0.1:8765 for browser fixture checks.'));
