import test from 'node:test';
import assert from 'node:assert/strict';
import {renderMarkdown} from '../markdown.js';
import {safeFilename,exportFilename,recordMarkdown,allMarkdown} from '../exports.js';
import {freshData} from '../core.js';
test('Markdown 标题、强调、列表、引用、代码、任务和表格',()=>{
  const html=renderMarkdown('# 标题\n\n**重要** 与 *感想* 与 ~~修正~~\n\n- [x] 完成\n- 普通条目\n\n> 引用\n\n```js\nconst x = "<script>";\n```\n\n| 概念 | 理解 |\n| --- | --- |\n| 泛化 | 新数据表现 |');
  for(const fragment of ['<h1>标题</h1>','<strong>重要</strong>','<em>感想</em>','<del>修正</del>','☑','<blockquote>','<pre><code class="language-js">','&lt;script&gt;','<table>','<td>泛化</td>'])assert.ok(html.includes(fragment),fragment);
});
test('Markdown 拒绝 HTML、脚本链接、属性注入和伪造占位符',()=>{
  const html=renderMarkdown('<img src=x onerror=alert(1)>\n\n[危险](javascript:alert) [正常](https://example.com)\n\n```evil" onclick="x\n<script>alert(1)</script>\n```\n\n\u00000\u0000 [x](data:text/html,evil)');
  assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('href="javascript:'));assert.ok(!html.includes('href="data:'));assert.ok(!html.includes('class="language-evil'));assert.ok(html.includes('rel="noopener noreferrer"'));
});
test('文件名处理 Windows 保留名、非法字符、尾部点和超长 Unicode 标题',()=>{
  assert.equal(safeFilename('CON'),'_CON');assert.equal(safeFilename(' .. 标题：a/b\\c?*. '),'标题：a-b-c-');
  assert.ok(!/[<>:"/\\|?*\u0000-\u001f]/.test(safeFilename('a:b?c|d')));
  assert.equal(Array.from(safeFilename('😊'.repeat(100))).length,65);
  const now=new Date('2026-11-26T07:30:01.123Z');const name=exportFilename({date:'2026-11-25',kind:'知识笔记',title:'AI/推理',now});
  assert.equal(name,'2026-11-25_知识笔记_AI-推理_导出-2026-11-26_15-30-01-123.md');
});
test('单篇导出保留原 Markdown、原日期、证据与边界；全量包含实践',()=>{
  const record={id:'e1',date:'2026-11-20',title:'模型',domain:'AI',stage:'thinking',tags:[],content:'# 我的原文\n\n**说明**',fact:'证据',opinion:'解释',boundary:'边界',rule:'规律',question:'追问',type:'knowledge'};
  const text=recordMarkdown('entries',record,{now:new Date('2026-11-26T00:00:00Z')});
  for(const v of ['2026-11-20','# 我的原文','**说明**','证据','边界','追问','导出时间：2026-11-26_08-00-00-000'])assert.ok(text.includes(v));
  const d=freshData();d.entries=[record];d.projects=[{id:'p1',title:'实验',description:'交付代码',done:true}];const all=allMarkdown(d);assert.ok(all.includes('- [x] 实验'));assert.ok(all.includes('交付代码'));
});
