import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeHotboards,hotboardState,renderHotboards,publicUrl} from '../hotboards.js';
const date='2026-11-26T09:00:00Z',now=Date.parse(date);
const board={id:'weibo',status:'ready',updatedAt:date,label:'热搜榜',items:[{rank:1,title:'测试话题',url:'https://s.weibo.com/weibo?q=test',metric:'10万 热度'}]};
test('榜单快照按平台显示并保留原排名，不做跨平台混排',()=>{
  const result=normalizeHotboards({version:1,boards:[{...board,items:[{rank:5,title:'第五',url:'https://weibo.com/a'},{rank:2,title:'第二',url:'https://weibo.com/b'}]}]});
  assert.equal(result.length,6);assert.deepEqual(result.find(b=>b.id==='weibo').items.map(i=>i.rank),[2,5]);
  assert.equal(result.find(b=>b.id==='xiaohongshu').items.length,0);
});
test('陈旧、更新失败、未来或缺失时间均正确区分',()=>{
  const b=normalizeHotboards({version:1,boards:[board]}).find(b=>b.id==='weibo');
  assert.equal(hotboardState(b,now).code,'ready');assert.equal(hotboardState(b,now+4*3600000).code,'stale');
  assert.equal(hotboardState({...b,status:'stale'},now).code,'stale');
  assert.equal(hotboardState({...b,updatedAt:null},now).code,'unavailable');
  assert.equal(hotboardState({...b,updatedAt:'2026-11-27T09:00:00Z'},now).code,'unavailable');
});
test('清洗外部数据，拒绝脚本链接与伪平台域名，标题正常转义',()=>{
  const result=normalizeHotboards({version:1,boards:[{...board,items:[{rank:1,title:'<img onerror=evil>',url:'https://weibo.com/test'},{rank:2,title:'错误',url:'javascript:alert(1)'},{rank:3,title:'错误',url:'https://weibo.com.evil.test/a'}]}]});
  assert.equal(result.find(b=>b.id==='weibo').items.length,1);
  const html=renderHotboards({version:1,boards:[{...board,updatedAt:new Date().toISOString(),items:result.find(b=>b.id==='weibo').items}]});
  assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img'));assert.ok(!html.includes('href="javascript:'));
  assert.equal(publicUrl('https://user:pass@weibo.com/a','weibo'),'');
});
