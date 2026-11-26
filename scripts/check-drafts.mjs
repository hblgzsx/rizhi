import {createRequire} from 'node:module';
import {mkdir,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
const url=(process.env.TEST_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const password='draft-inbox-test-password';let checks=0;
const ok=text=>{checks++;console.log('PASS '+text);};
const click=async selector=>{await page.locator(selector).first().click();if(selector==='.writer-back')await page.locator('.writer-page').waitFor({state:'detached'});};
const card=title=>page.locator('.draft-card').filter({has:page.locator('h2',{hasText:title})});
const drafts=async()=>{await page.goto(url+'/#drafts');await page.locator('.drafts-grid').waitFor();};
const closed=()=>page.waitForFunction(()=>!document.querySelector('.writer-page,.modal'));
const vaultData=()=>page.evaluate(async password=>{const {unseal}=await import('./core.js');return (await unseal(JSON.parse(localStorage.getItem('rizhi.v1.vault')),password)).data;},password);
try {
  await mkdir('test-results',{recursive:true});await page.goto(url);await click('[data-action=auth]');await page.locator('[name=name]').fill('草稿测试');await page.locator('[name=password]').fill(password);await page.locator('[name=confirm]').fill(password);await click('#auth-form [type=submit]');await closed();
  await click('[data-action=capture]');await click('.writer-back');await drafts();assert.equal(await page.locator('.draft-card').count(),0);ok('仅打开空白写作页，不产生草稿');
  for(const [title,text] of [['第一篇未完成','独立内容 A'],['第二篇未完成','独立内容 B']]){
    await click('[data-action=capture]');assert.equal(await page.locator('[name=title]').inputValue(),'');assert.equal(await page.locator('[name=content]').inputValue(),'');
    await page.locator('[name=title]').fill(title);await page.locator('[name=content]').fill(text);await click('.writer-back');await drafts();
  }
  assert.equal(await page.locator('.draft-card').count(),2);const snapshot=await vaultData();assert.equal(Object.keys(snapshot.drafts).length,2);assert.equal(snapshot.entries.length,0);ok('多篇新建笔记独立存放，互不覆盖且不计入正式笔记');
  await page.screenshot({path:'test-results/drafts-desktop.png',fullPage:true});
  await card('第一篇未完成').locator('[data-action=draft-open]').first().click();assert.equal(await page.locator('[name=content]').inputValue(),'独立内容 A');await page.locator('[name=content]').fill('独立内容 A，继续扩展');await page.waitForTimeout(1100);await click('.writer-back');await drafts();assert.equal(await page.locator('.draft-card').count(),2);ok('从草稿箱继续原草稿，修改只更新这一份');
  await card('第一篇未完成').locator('[data-action=draft-open]').first().click();await page.reload();await page.locator('[name=password]').fill(password);await click('#auth-form [type=submit]');await page.locator('.writer-page').waitFor();assert.equal(await page.locator('[name=content]').inputValue(),'独立内容 A，继续扩展');await click('.writer-back');ok('刷新和重新登录定位同一份草稿，不另建或混入其他内容');
  await drafts();const downloadPromise=page.waitForEvent('download');await card('第二篇未完成').locator('[data-action=draft-export]').click();const file=await downloadPromise;await file.saveAs('test-results/draft-export.md');assert.ok((await readFile('test-results/draft-export.md','utf8')).includes('独立内容 B'));ok('草稿可在独立区域单篇导出 Markdown');
  await card('第一篇未完成').locator('[data-action=draft-open]').first().click();await click('[data-action=writer-save]');await closed();await drafts();assert.equal(await card('第一篇未完成').count(),0);assert.equal(await card('第二篇未完成').count(),1);await page.goto(url+'/#library');assert.equal(await page.locator('.entry-card').filter({hasText:'第一篇未完成'}).count(),1);ok('正式保存只移出对应草稿，保留其他草稿且只创建一条正式记录');
  await page.locator('.entry-card').filter({hasText:'第一篇未完成'}).click();await click('[data-action=edit-entry]');await page.locator('[name=content]').fill('临时修改后撤回');await page.locator('[name=content]').fill('独立内容 A，继续扩展');await click('.writer-back');await drafts();assert.equal(await page.locator('.draft-card').count(),1);ok('正式记录修改后恢复原文，不产生无意义的草稿');
  await page.goto(url+'/#library');await page.locator('.entry-card').filter({hasText:'第一篇未完成'}).click();await click('[data-action=edit-entry]');await page.locator('[name=content]').fill('正式记录的未发布修改');await click('.writer-back');
  await page.goto(url+'/#library');await page.locator('.entry-card').filter({hasText:'第一篇未完成'}).click();assert.ok((await page.locator('.entry-detail').innerText()).includes('独立内容 A，继续扩展'));assert.ok(!(await page.locator('.entry-detail').innerText()).includes('未发布修改'));await click('.modal-close');await drafts();ok('编辑正式记录的未保存修改只进入草稿箱，不提前改写正式内容');
  await card('第一篇未完成').locator('[data-action=draft-delete]').click();await page.locator('.modal [data-action=close]').first().click();assert.equal(await card('第一篇未完成').count(),1);
  await card('第一篇未完成').locator('[data-action=draft-delete]').click();await click('[data-action=draft-delete-confirm]');await page.locator('.modal').waitFor({state:'detached'});assert.equal(await card('第一篇未完成').count(),0);assert.equal(await card('第二篇未完成').count(),1);await page.goto(url+'/#library');assert.equal(await page.locator('.entry-card').count(),1);ok('取消删除保留草稿，确认删除不影响正式记录与其他草稿');
  await drafts();await click('[data-action=capture]');await click('.writer-back');await drafts();assert.equal(await page.locator('.draft-card').count(),1);ok('有历史草稿时再次打开空白页面，不产生重复草稿');
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/drafts-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await card('第二篇未完成').locator('[data-action=draft-open]').first().click();assert.equal(await page.locator('[name=title]').inputValue(),'第二篇未完成');await click('.writer-back');ok('手机草稿箱无横向溢出，可继续指定草稿');
  await drafts();await card('第二篇未完成').locator('[data-action=draft-open]').first().click();
  await page.evaluate(()=>{globalThis.draftTestSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='rizhi.v1.vault')throw new DOMException('Test quota exceeded','QuotaExceededError');return globalThis.draftTestSetItem.call(this,key,value);};});
  await click('[data-action=writer-save]');await page.waitForFunction(()=>document.querySelector('#save-status')?.textContent.includes('保存失败'));assert.ok(await page.locator('.writer-page').isVisible());assert.equal((await vaultData()).entries.length,1);
  await page.evaluate(()=>{Storage.prototype.setItem=globalThis.draftTestSetItem;delete globalThis.draftTestSetItem;});await click('[data-action=writer-save]');await closed();const retried=await vaultData();assert.equal(retried.entries.filter(e=>e.title==='第二篇未完成').length,1);assert.equal(Object.values(retried.drafts).filter(d=>d.fields.title==='第二篇未完成').length,0);ok('模拟保存失败保留编辑与原记录，重试只产生一条正式笔记');
  // Seed an old encrypted vault to verify real upgrade behavior, not only the pure migration function.
  const legacy=await browser.newContext();const old=await legacy.newPage();await old.goto(url);
  await old.evaluate(async password=>{const {freshData,createKey,seal}=await import('./core.js');const d=freshData('旧版用户');d.drafts={'entry-form:new:':{fields:{title:'旧版未完成',content:'旧版全文保留'},updatedAt:'2026-11-25T12:00:00Z'},'journal-form:2026-11-24:true':{fields:{experience:'旧日记全文',date:'2026-11-24',mood:'平静'},updatedAt:'2026-11-24T12:00:00Z'}};const {key,salt}=await createKey(password);localStorage.setItem('rizhi.v1.vault',JSON.stringify(await seal(d,key,salt)));},password);
  await old.reload();await old.locator('[name=password]').fill(password);await old.locator('#auth-form [type=submit]').click();await old.locator('.modal').waitFor({state:'detached'});await old.goto(url+'/#drafts');assert.equal(await old.locator('.draft-card').count(),2);await old.locator('.draft-card').filter({hasText:'旧版未完成'}).locator('[data-action=draft-open]').first().click();assert.equal(await old.locator('[name=content]').inputValue(),'旧版全文保留');await old.locator('.writer-back').click();await old.goto(url+'/#drafts');await old.locator('.draft-card').filter({hasText:'旧日记全文'}).locator('[data-action=draft-open]').first().click();assert.equal(await old.locator('[name=date]').inputValue(),'2026-11-24');assert.equal(await old.locator('[name=experience]').inputValue(),'旧日记全文');await legacy.close();ok('旧版草稿自动迁入草稿箱，保留内容、日期及轻量模式');
  assert.deepEqual(errors,[]);ok('全流程无未捕获 JavaScript 错误');console.log(`ALL ${checks} DRAFT INBOX CHECKS PASSED`);
}finally{await browser.close();}
