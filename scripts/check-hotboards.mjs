import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
const url=(process.env.TEST_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());let checks=0;
const pass=title=>{checks++;console.log('PASS '+title);};
const click=selector=>page.locator(selector).first().click();
try {
  await mkdir('test-results',{recursive:true});
  const ids=['douyin','weibo','bilibili','xiaohongshu','zhihu','toutiao'];
  const hosts={douyin:'https://www.douyin.com/search/',weibo:'https://s.weibo.com/weibo?q=',bilibili:'https://www.bilibili.com/video/',xiaohongshu:'https://www.xiaohongshu.com/search_result?keyword=',zhihu:'https://www.zhihu.com/question/',toutiao:'https://www.toutiao.com/trending/'};
  const fixture={version:1,generatedAt:new Date().toISOString(),boards:ids.map(id=>({id,status:id==='xiaohongshu'?'unavailable':id==='weibo'?'stale':'ready',updatedAt:id==='xiaohongshu'?null:new Date(Date.now()-(id==='weibo'?86400000:10000)).toISOString(),provider:'测试公开源',providerUrl:'https://example.com/',label:'测试榜单',items:id==='xiaohongshu'?[]:Array.from({length:15},(_,i)=>({rank:i+1,title:id==='douyin'&&i===0?'<img src=x onerror=evil> 研究一个热点':`${id} 第 ${i+1} 个测试热点`,url:hosts[id]+(id==='bilibili'?'BVtest':'test')+(i+1),metric:'12.3万 热度',author:'测试作者'}))}))};
  await page.route('**/data/hotboards.json*',route=>route.fulfill({json:fixture}));
  await page.goto(url+'/#world');await page.locator('[data-board=douyin] .hotboard-items li').first().waitFor();
  assert.equal(await page.locator('.hotboard-card').count(),6);assert.equal(await page.locator('[data-board=douyin] .hotboard-items li').count(),6);assert.equal(await page.locator('[data-board=weibo] .hotboard-state').innerText(),'上次快照');assert.equal(await page.locator('[data-board=xiaohongshu] .hotboard-state').innerText(),'暂不可用');pass('六个平台分榜展示，正常、旧快照、不可用状态分别呈现');
  assert.equal(await page.locator('#hotboards img').count(),0);assert.ok((await page.locator('[data-board=douyin]').innerText()).includes('<img'));pass('热榜外部标题以安全文字显示');
  await page.locator('[data-board=douyin] [data-action=hot-expand]').click();assert.equal(await page.locator('[data-board=douyin] .hotboard-items li').count(),15);await page.locator('[data-board=douyin] [data-action=hot-expand]').click();assert.equal(await page.locator('[data-board=douyin] .hotboard-items li').count(),6);pass('默认前六条，展开前十五条，再收起');
  await page.locator('[data-action=hot-filter][data-platform=bilibili]').click();assert.equal(await page.locator('.hotboard-card').count(),1);assert.equal(await page.locator('[data-board=bilibili]').count(),1);await page.locator('[data-action=hot-filter][data-platform=all]').click();pass('平台筛选与全部榜单切换');
  await page.screenshot({path:'test-results/hotboards-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.locator('#hotboards').screenshot({path:'test-results/hotboards-mobile.png'});pass('手机各榜单无整体横向溢出');
  await page.setViewportSize({width:1440,height:1000});await click('[data-action=hot-save]');await page.locator('#auth-form').waitFor();await page.locator('[name=name]').fill('榜单测试');await page.locator('[name=password]').fill('hotboards-test-password');await page.locator('[name=confirm]').fill('hotboards-test-password');await click('#auth-form [type=submit]');await page.locator('.modal').waitFor({state:'detached'});
  await page.goto(url+'/#world');await page.locator('[data-board=bilibili] [data-action=hot-save]').first().click();await page.locator('.writer-page').waitFor();assert.equal(await page.locator('[name=sourcePlatform]').inputValue(),'B 站');assert.equal(await page.locator('[name=sourceAuthor]').inputValue(),'测试作者');assert.ok((await page.locator('[name=content]').inputValue()).includes('榜单快照时间'));assert.equal(await page.locator('[name=type]').inputValue(),'event');await click('[data-action=writer-save]');await page.locator('.writer-page').waitFor({state:'detached'});await page.goto(url+'/#library');assert.equal(await page.locator('.entry-card').count(),1);pass('热榜收藏要求登录，保留平台、原链接、作者、排名与快照时间');
  await page.goto(url+'/#world');await page.unroute('**/data/hotboards.json*');await page.route('**/data/hotboards.json*',route=>route.fulfill({status:503,body:'unavailable'}));await click('[data-action=hot-refresh]');await page.waitForFunction(()=>!document.querySelector('[data-action=hot-refresh]')?.disabled);assert.equal(await page.locator('[data-board=douyin] .hotboard-items li').count(),6);pass('刷新接口失败保留现有快照，不清空已展示榜单');
  assert.deepEqual(errors,[]);pass('所有交互无未捕获异常');
  if(process.env.TEST_URL){await page.unroute('**/data/hotboards.json*');await page.reload();await page.locator('#auth-form').waitFor();await page.locator('[name=password]').fill('hotboards-test-password');await click('#auth-form [type=submit]');await page.locator('.modal').waitFor({state:'detached'});await page.goto(url+'/#world');await page.waitForFunction(()=>!document.querySelector('[data-action=hot-refresh]')?.disabled);assert.ok(await page.locator('.hotboard-items li').count()>0);pass('线上真实快照含可展示热点，非测试数据');}
  console.log(`ALL ${checks} HOTBOARD CHECKS PASSED`);
}finally{await browser.close();}
