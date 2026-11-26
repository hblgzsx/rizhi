import test from 'node:test';
import assert from 'node:assert/strict';
import {detectPlatform,extractSharedLink,SOCIAL_SOURCES} from '../sources.js';
import {recordMarkdown} from '../exports.js';
test('识别七个平台、官方子域名及常用短链接',()=>{
  for(const [url,name] of [['https://v.douyin.com/abc/','抖音'],['https://m.weibo.cn/detail/123','微博'],['https://b23.tv/abc','B 站'],['https://www.bilibili.com/video/BV1','B 站'],['http://xhslink.com/a/abc','小红书'],['https://www.xiaohongshu.com/explore/abc','小红书'],['https://www.zhihu.com/question/1','知乎'],['https://www.toutiao.com/article/1','今日头条'],['https://mp.weixin.qq.com/s/abc','微信公众号']])assert.equal(detectPlatform(url),name);
  assert.equal(SOCIAL_SOURCES.length,7);
});
test('分享文字提取链接、去掉尾部标点，不把相似域名误当平台',()=>{
  assert.deepEqual(extractSharedLink('复制打开抖音，看看这个视频 https://v.douyin.com/abc/， 来自作者。'),{url:'https://v.douyin.com/abc/',platform:'抖音'});
  assert.equal(extractSharedLink('这是我读到的文章，没有链接'),null);
  assert.equal(extractSharedLink('javascript:alert(1)'),null);
  assert.equal(detectPlatform('https://douyin.com.attacker.test/'),'');
  assert.equal(detectPlatform('https://notweibo.com/'),'');
  assert.equal(extractSharedLink('https://user:password@example.com/'),null);
});
test('Markdown 导出保留平台、作者和来源链接',()=>{
  const text=recordMarkdown('entries',{title:'一个平台观察',date:'2026-11-26',domain:'社会',stage:'inbox',type:'knowledge',tags:[],source:'https://b23.tv/test',sourcePlatform:'B 站',sourceAuthor:'示例作者',content:'我的笔记'});
  for(const word of ['B 站','示例作者','https://b23.tv/test','我的笔记'])assert.ok(text.includes(word));
});
