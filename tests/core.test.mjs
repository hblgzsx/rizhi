import test from 'node:test';
import assert from 'node:assert/strict';
import { dayKey, addDays, freshData, stats, activeDates, reviewEntry, createKey, seal, unseal, validateData } from '../core.js';

test('中国时区日期与跨年、闰年计算', () => {
  assert.equal(dayKey(new Date('2026-11-25T16:01:00Z')), '2026-11-26');
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});
test('累计按日期去重，断签不丢累计，周日与周一界限正确', () => {
  const data = freshData();
  data.journals = [{date:'2026-11-22'}, {date:'2026-11-24'}, {date:'2026-11-25'}];
  data.entries = [{date:'2026-11-25',stage:'thinking',nextReview:'2026-11-26'}];
  assert.equal(activeDates(data).length, 3);
  const s = stats(data, '2026-11-26');
  assert.equal(s.days,3); assert.equal(s.streak,2); assert.equal(s.weekDays,2); assert.equal(s.monday,'2026-11-23');
  assert.equal(stats(data,'2026-11-27').streak,0);
  assert.equal(stats(data,'2026-11-22').weekDays,1);
});
test('间隔回想随熟悉度递增，忘记后回到次日', () => {
  let e={reviewCount:0};
  for(const interval of [1,3,7,14,30,90,90]) { e=reviewEntry(e,true,'2026-11-26');assert.equal(e.nextReview,addDays('2026-11-26',interval)); }
  e=reviewEntry(e,false,'2026-11-26');assert.equal(e.reviewCount,0);assert.equal(e.nextReview,'2026-11-27');
});
test('完整记录加密后可以恢复，密文不含私人日记', async () => {
  const data=freshData('测试同学');data.journals=[{id:'test-j',date:'2026-11-26',experience:'不应出现在密文里的私密经历',thought:'感想',takeaway:'总结'}];
  const {key,salt}=await createKey('测试用长密码-12345');
  const vault=await seal(data,key,salt);
  assert.ok(!JSON.stringify(vault).includes(data.journals[0].experience));
  const restored=await unseal(vault,'测试用长密码-12345');assert.deepEqual(restored.data,data);
  const again=await seal(data,key,salt);assert.notEqual(again.iv,vault.iv);assert.notEqual(again.ciphertext,vault.ciphertext);
});
test('密码错误与密文被篡改均拒绝恢复', async () => {
  const {key,salt}=await createKey('正确密码-test-123');const vault=await seal(freshData(),key,salt);
  await assert.rejects(unseal(vault,'错误密码-test-123'),/密码不正确/);
  const tampered={...vault,ciphertext:(vault.ciphertext[0]==='A'?'B':'A')+vault.ciphertext.slice(1)};
  await assert.rejects(unseal(tampered,'正确密码-test-123'),/密码不正确/);
});
test('支持大型知识存档的分块编码', async () => {
  const data=freshData();data.journals=[{id:'large-j',date:'2026-11-26',experience:'较长的私人记录'.repeat(25000),thought:'',takeaway:''}];
  const {key,salt}=await createKey('large-test-password');const vault=await seal(data,key,salt);assert.deepEqual((await unseal(vault,'large-test-password')).data,data);
});
test('拒绝错误备份结构、重复标识与危险插值', () => {
  assert.throws(()=>validateData({version:2}));
  const data=freshData();data.profile.dailyMinutes='<script>';assert.throws(()=>validateData(data));
  const bad=freshData();bad.projects=[{id:'" onclick="evil',title:'x',done:false}];assert.throws(()=>validateData(bad));
  const duplicate=freshData();duplicate.projects=[{id:'p',title:'x',done:false},{id:'p',title:'y',done:false}];assert.throws(()=>validateData(duplicate));
});
