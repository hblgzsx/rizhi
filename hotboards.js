import {SOCIAL_SOURCES} from './sources.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const ids=['douyin','weibo','bilibili','xiaohongshu','zhihu','toutiao'];
export function publicUrl(value,platform) {
  try{const url=new URL(value);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return '';if(platform){const source=SOCIAL_SOURCES.find(s=>s.id===platform);if(!source||!source.domains.some(domain=>url.hostname===domain||url.hostname.endsWith('.'+domain)))return '';}return url.href;}catch{return '';}
}
export function normalizeHotboards(payload) {
  const boards=payload?.version===1&&Array.isArray(payload.boards)?payload.boards:[];
  return ids.map(id=>{
    const source=SOCIAL_SOURCES.find(s=>s.id===id),raw=boards.find(b=>b?.id===id)||{},seen=new Set();
    const items=(Array.isArray(raw.items)?raw.items:[]).filter(item=>{
      if(!item||typeof item.title!=='string'||!item.title.trim()||!Number.isInteger(item.rank)||item.rank<1||item.rank>1000||!publicUrl(item.url,id)||seen.has(item.url))return false;
      seen.add(item.url);return true;
    }).sort((a,b)=>a.rank-b.rank).slice(0,15).map(item=>({rank:item.rank,title:item.title.slice(0,240),url:publicUrl(item.url,id),metric:typeof item.metric==='string'?item.metric.slice(0,70):'',author:typeof item.author==='string'?item.author.slice(0,80):''}));
    return {id,name:source.name,mark:source.mark,tone:source.tone,label:typeof raw.label==='string'?raw.label:'热点榜',url:publicUrl(raw.url,id)||source.url,status:['ready','stale','unavailable'].includes(raw.status)?raw.status:'unavailable',updatedAt:typeof raw.updatedAt==='string'?raw.updatedAt:null,provider:typeof raw.provider==='string'?raw.provider:'',providerUrl:publicUrl(raw.providerUrl),items};
  });
}
export function hotboardState(board,now=Date.now()) {
  const updated=Date.parse(board.updatedAt),age=now-updated;
  if(!board.items.length||!Number.isFinite(updated)||age < -10*60000)return {code:'unavailable',label:'暂不可用',date:'尚无可用快照'};
  const date=new Date(updated).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
  if(board.status!=='ready'||age>3*3600000)return {code:'stale',label:'上次快照',date};
  return {code:'ready',label:'已更新',date};
}
export function renderHotboards(snapshot,{filter='all',expanded=new Set(),loading=false}={}) {
  const boards=normalizeHotboards(snapshot),visible=boards.filter(b=>filter==='all'||b.id===filter);
  return `<section id="hotboards" class="hotboards-section"><div class="section-heading"><div><span class="eyebrow">WHAT PEOPLE ARE TALKING ABOUT</span><h2>各平台，此刻在关注什么</h2></div><button class="btn outline compact" data-action="hot-refresh" ${loading?'disabled':''}>${loading?'读取中…':'重新读取榜单'}</button></div><p class="hotboards-intro">看看热点，再选一件值得追问的事。按平台原榜顺序展示，每小时尝试更新；各平台热度口径不同，不作跨平台比较。</p><div class="hotboard-filters" role="group" aria-label="选择平台榜单">${[['all','全部平台'],...boards.map(b=>[b.id,b.name])].map(([id,name])=>`<button class="${filter===id?'selected':''}" data-action="hot-filter" data-platform="${id}" aria-pressed="${filter===id}">${name}</button>`).join('')}</div><div class="hotboards-grid">${visible.map(board=>{
    const state=hotboardState(board),items=state.code==='unavailable'?[]:board.items;
    const count=expanded.has(board.id)?15:6;
    return `<article class="hotboard-card" data-board="${board.id}"><header><span class="platform-mark ${board.tone}">${esc(board.mark)}</span><div><h3>${esc(board.name)}</h3><span>${esc(board.label)}</span></div><span class="hotboard-state ${state.code}"><i></i>${state.label}</span></header><div class="hotboard-updated"><span>数据时间 ${esc(state.date)}</span><a href="${esc(board.url)}" target="_blank" rel="noopener noreferrer">平台原榜 ↗</a></div>${state.code==='stale'?'<p class="hotboard-warning">当前展示上次快照，排名可能已变化。</p>':''}<ol class="hotboard-items">${items.slice(0,count).map(item=>`<li><span class="hot-rank ${item.rank<=3?'top-rank':''}">${item.rank}</span><div><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a>${item.metric?`<small>${esc(item.metric)}</small>`:''}</div><button data-action="hot-save" data-platform="${board.id}" data-rank="${item.rank}" aria-label="记录话题：${esc(item.title)}" title="收入知识花园">＋</button></li>`).join('')}</ol>${!items.length?`<div class="hotboard-empty"><span>这份榜单暂未取得</span><p>${board.id==='xiaohongshu'?'数据源可能限流，稍后会再尝试。':'请稍后再看，也可以打开平台原榜。'}</p><a href="${esc(board.url)}" target="_blank" rel="noopener noreferrer">去平台看看 ↗</a></div>`:''}<footer>${items.length>6?`<button data-action="hot-expand" data-platform="${board.id}">${expanded.has(board.id)?'收起榜单':'展开前 '+items.length+' 条'} <span>⌄</span></button>`:'<span>热榜标题不代表事实核验。</span>'}${board.provider&&items.length?`<a class="hotboard-provider" ${board.providerUrl?`href="${esc(board.providerUrl)}" target="_blank" rel="noopener noreferrer"`:''}>来源：${esc(board.provider)}</a>`:''}</footer></article>`;
  }).join('')}</div><div class="hotboards-footnote"><span>热榜快照有延迟；“重新读取”获取最近已发布快照。微信暂未接入统一公开热榜，可继续粘贴公众号文章收藏。</span></div></section>`;
}
