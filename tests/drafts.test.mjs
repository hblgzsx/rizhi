import test from 'node:test';
import assert from 'node:assert/strict';
import {freshData,migrateDrafts,validateData,stats,createKey,seal,unseal} from '../core.js';
test('旧版共享入口草稿迁移到独立编号，保留全文、日期和目标记录',()=>{
  const data=freshData();data.drafts={
    'entry-form:new:':{fields:{title:'旧知识草稿',content:'全文'},updatedAt:'2026-11-25T12:00:00Z'},
    'journal-form:2026-11-24:true':{fields:{experience:'旧日记',date:'2026-11-24'},updatedAt:'2026-11-24T10:00:00Z'},
    'weekly-form:review-id:':{fields:{insight:'修改中的复盘'},updatedAt:'2026-11-23T12:00:00Z'},
    'project-form:new:':{fields:{title:'实践草稿',description:'交付结果'}}
  };
  migrateDrafts(data);assert.equal(Object.keys(data.drafts).length,4);
  const drafts=Object.values(data.drafts);assert.equal(new Set(drafts.map(d=>d.id)).size,4);
  assert.equal(drafts.find(d=>d.kind==='entry').fields.content,'全文');
  assert.equal(drafts.find(d=>d.kind==='journal').fields.date,'2026-11-24');
  assert.equal(drafts.find(d=>d.kind==='journal').recordId,'');assert.equal(drafts.find(d=>d.kind==='journal').quick,true);
  assert.equal(drafts.find(d=>d.kind==='weekly').recordId,'review-id');
  assert.doesNotThrow(()=>validateData(data));
  const before=structuredClone(data);migrateDrafts(data);assert.deepEqual(data,before);
});
test('独立草稿随加密备份恢复，草稿数量不增加成长统计',async()=>{
  const d=freshData();d.drafts={'draft-one':{id:'draft-one',kind:'entry',recordId:'',quick:false,fields:{title:'甲',content:'私密内容'},createdAt:'2026-11-26T00:00:00Z',updatedAt:'2026-11-26T01:00:00Z'},'draft-two':{id:'draft-two',kind:'entry',recordId:'',quick:false,fields:{title:'乙'},createdAt:'2026-11-26T00:00:00Z',updatedAt:'2026-11-26T01:00:00Z'}};
  assert.equal(stats(d,'2026-11-26').days,0);assert.equal(stats(d).cards,0);
  const {key,salt}=await createKey('draft-vault-test-password');const vault=await seal(d,key,salt);const restored=(await unseal(vault,'draft-vault-test-password')).data;
  assert.deepEqual(restored.drafts,d.drafts);assert.ok(!JSON.stringify(vault).includes('私密内容'));
});
test('备份拒绝危险草稿编号或异常类型',()=>{
  const d=freshData();d.drafts.x={id:'x',kind:'<script>',recordId:'',quick:false,fields:{title:'x'}};assert.throws(()=>validateData(d));
  d.drafts.x={id:'x',kind:'entry',recordId:'bad"id',quick:false,fields:{title:'x'}};assert.throws(()=>validateData(d));
});
