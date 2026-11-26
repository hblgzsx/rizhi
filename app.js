import { DOMAINS, dayKey, addDays, uid, freshData, activeDates, stats, reviewEntry, createKey, seal, unseal, migrateDrafts } from './core.js?v=4-sources';
import { renderMarkdown } from './markdown.js';
import { exportFilename, recordMarkdown, allMarkdown } from './exports.js?v=4-sources';
import { SOCIAL_SOURCES, detectPlatform, extractSharedLink } from './sources.js';
import { normalizeHotboards, hotboardState, renderHotboards } from './hotboards.js';

const VAULT_KEY = 'rizhi.v1.vault';
const $ = (s, root = document) => root.querySelector(s);
const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const icons = {
  book: '<path d="M3 5c4-1 6 0 9 2 3-2 5-3 9-2v14c-4-1-6 0-9 2-3-2-5-3-9-2z"/><path d="M12 7v14"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  leaf: '<path d="M20 3C9 1 2 8 5 16s17 6 15-13Z"/><path d="m4 21 11-12"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8Zm-10 10 10 5 10-5M2 18l10 5 10-5"/>',
  chart: '<path d="M4 3v17h17M8 15l4-5 4 2 5-8"/>',
  refresh: '<path d="M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5M4 16a8 8 0 0 0 14 3l3-3m-5 0h5v5"/>',
  settings: '<path d="m9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h6l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3z"/><circle cx="12" cy="12" r="3"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  link: '<path d="m10 13 4-4m-7 5-2 2a4 4 0 0 0 6 6l4-4a4 4 0 0 0 0-6m2-2 2-2a4 4 0 0 0-6-6L9 5a4 4 0 0 0 0 6"/>',
  pen: '<path d="m15 4 5 5M3 21l5-1L21 7a3.5 3.5 0 0 0-5-5L3 15z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  spark: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.book}</svg>`;
function themeButton() {
  const dark=document.documentElement.dataset.theme==='dark',label=dark?'切换为浅色模式':'切换为深色模式';
  return `<button class="icon-button theme-toggle" type="button" data-action="theme-toggle" aria-label="${label}" title="${label}" aria-pressed="${dark}"><svg class="icon theme-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 13.4A8.8 8.8 0 0 1 10.6 3.2a8.8 8.8 0 1 0 10.2 10.2Z"/></svg><svg class="icon theme-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg></button>`;
}
const navs = [['today', 'sun', '今日'], ['journal', 'pen', '生活手记'], ['library', 'layers', '知识花园'], ['drafts', 'pen', '草稿箱'], ['world', 'globe', '看见世界'], ['focus', 'book', '我的主修'], ['review', 'refresh', '回望与表达'], ['growth', 'chart', '成长足迹']];
let data = freshData(), key = null, salt = null, storedRaw = null, preview = true, page = 'today', filter = '全部', query = '', domainFilter = '全部', news = { items: [] }, saveQueue = Promise.resolve(), saveFailure = null, conflict = false;
let cloudToken = '', cloudSha = null, cloudTarget = '', lastActivity = Date.now(), lastFocus;
let draftTimer, currentDraftKey = '', editorDirty = false, pendingSaves = 0;
let writerState = null, pendingWriterRoute = '';
let draftToResume = null;
let hotSnapshot={version:1,boards:[]},hotFilter='all',hotExpanded=new Set(),hotLoading=false;

const demo = freshData('探索者');
demo.entries = [
  { id: 'demo-1', title: '理解一个模型，从问对问题开始', content: '读完论文，不急着记术语。先试着解释：它解决了什么问题，为什么这样设计，什么情况下会失效？', domain: DOMAINS[0], type: 'knowledge', date: dayKey(), stage: 'thinking', source: 'https://arxiv.org/', fact: '这是一张演示卡片，用来展示思考的结构。', opinion: '理解的标志是能用自己的话解释边界。', question: '我能用一个例子向朋友说明白吗？', rule: '', tags: ['学习方法'], nextReview: dayKey(), reviewCount: 0 },
  { id: 'demo-2', title: '看社会事件，也看背后的激励', content: '记录一件事时，试着同时问：参与者是谁？他们各自追求什么？谁承担成本？', domain: DOMAINS[1], type: 'event', date: addDays(dayKey(), -1), stage: 'inbox', source: '', fact: '', opinion: '', question: '还有什么相反的证据？', rule: '', tags: ['社会观察'], nextReview: addDays(dayKey(), 1), reviewCount: 0 },
  { id: 'demo-3', title: '让知识长出连接', content: '把今天的一个想法，连接到过去的一个经验。小小的联系，往往比多收藏一篇文章更有用。', domain: DOMAINS[3], type: 'knowledge', date: addDays(dayKey(), -2), stage: 'understood', source: '', fact: '', opinion: '', question: '', rule: '在不同情境中检验同一个解释，保留例外。', tags: ['认知积累'], nextReview: addDays(dayKey(), 3), reviewCount: 1 },
];
demo.journals = [{ id: 'demo-j', date: addDays(dayKey(), -1), experience: '今天散步时，注意到一家小店更换了经营方式。', thought: '普通的生活里，也藏着值得理解的商业选择。', takeaway: '多问一个为什么，就多一扇观察世界的窗。', mood: '平静' }];
data = structuredClone(demo);

function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.timeout); toast.timeout = setTimeout(() => el.classList.remove('show'), 3800); }
function safeUrl(value) { try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } }
function sourceLink(url, label = '阅读原文') { const safe = safeUrl(url); return safe ? `<a class="source-link" href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${icon('link')}${esc(label)} ↗</a>` : ''; }
function labelDate(day) { return new Date(`${day}T12:00:00+08:00`).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' }); }
function empty(title, description, button = '') { return `<div class="empty"><div class="empty-icon">${icon('leaf')}</div><h3>${title}</h3><p>${description}</p>${button}</div>`; }
function btn(label, action, cls = 'primary', extra = '') { return `<button type="button" class="btn ${cls}" data-action="${action}" ${extra}>${label}</button>`; }
function requireAccount(allowConflict = false) { if (preview) { authModal(); return false; } if (conflict && !allowConflict) { toast('另一标签页已更新记录。请先导出本页备份，再锁定并重新登录。'); return false; } return true; }
async function persist() {
  if (preview || !key || conflict) return;
  const snapshot = structuredClone(data), currentKey = key, currentSalt = salt;
  pendingSaves++;
  saveQueue = saveQueue.catch(() => {}).then(async () => {
    try {
      const vault = await seal(snapshot, currentKey, currentSalt);
      if (localStorage.getItem(VAULT_KEY) !== storedRaw) { conflict = true; throw new Error('另一标签页更新了记录，请重新登录后再继续。'); }
      const nextRaw = JSON.stringify(vault); localStorage.setItem(VAULT_KEY, nextRaw); storedRaw = nextRaw; saveFailure = null;
      const el = $('#save-status'); if (el) el.textContent = '已加密保存于此设备';
    } catch (e) { saveFailure = e; const el = $('#save-status'); if (el) el.textContent = '保存失败，请立即导出备份'; toast(e.message || '保存失败，请导出备份。'); throw e; }
    finally { pendingSaves--; }
  });
  return saveQueue;
}
async function saveAndRender(message) { try { await persist(); render(); if (message) toast(message); return true; } catch { return false; } }
function render() {
  document.title = `${navs.find(n => n[0] === page)?.[2] || '设置'} · 日知`;
  const s = stats(data), date = new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', weekday: 'long' });
  $('#app').innerHTML = `<aside class="sidebar"><a class="brand" href="#today" aria-label="日知首页"><span class="brand-mark">${icon('book')}</span><span>日知<small>日有所记，知有所长</small></span></a>
    <div class="space-label">我的成长空间 <span class="small-leaf">✧</span></div><nav aria-label="主导航">${navs.map(([id, i, label]) => `<a href="#${id}" class="nav-item ${page === id ? 'active' : ''}" ${page === id ? 'aria-current="page"' : ''}>${icon(i)}<span>${label}</span>${id === 'drafts' && !preview && Object.keys(data.drafts||{}).length ? `<b class="nav-count">${Object.keys(data.drafts).length}</b>` : ''}${id === 'review' && s.due ? `<b class="nav-count">${s.due}</b>` : ''}</a>`).join('')}</nav>
    <div class="sidebar-note"><div class="seedling">${icon('leaf')}</div><p>让每天的一点点，<br>成为日后的不一样。</p><span>慢慢来，也是一种力量。</span></div>
    <div class="sidebar-bottom"><a class="nav-item ${page === 'settings' ? 'active' : ''}" href="#settings">${icon('settings')}<span>空间设置</span></a><button class="account" data-action="${preview ? 'auth' : 'lock'}"><span class="avatar">${esc(data.profile.name.slice(0, 1))}</span><span>${esc(preview ? '先逛逛这里' : data.profile.name)}<small>${preview ? '创建属于你的空间' : '点击锁定私人空间'}</small></span>${icon(preview ? 'arrow' : 'lock')}</button></div></aside>
    <div class="workspace"><header class="topbar"><span class="breadcrumb">我的空间 <span>/</span> ${navs.find(n => n[0] === page)?.[2] || '空间设置'}</span><div class="top-actions"><span class="date-label">${date}</span>${themeButton()}<button class="icon-button" data-action="search" aria-label="搜索知识">${icon('search')}</button>${btn(icon('plus') + ' 随手记', 'capture', 'primary compact')}</div></header>
    ${preview ? `<div class="preview-bar"><span>${icon('spark')} 你正在预览示例空间，下面的记录仅作演示。</span><button data-action="auth">${localStorage.getItem(VAULT_KEY) ? '登录我的空间' : '开启我的第一天'} ${icon('arrow')}</button></div>` : `<div class="private-status">${icon('lock')}<span id="save-status">${saveFailure ? '保存失败，请导出备份' : '已加密保存于此设备'}</span><span>·</span><a href="#settings">备份与跨设备同步</a></div>`}
    <main id="main" tabindex="-1">${({ today: todayView, journal: journalView, library: libraryView, world: worldView, focus: focusView, review: reviewView, growth: growthView, settings: settingsView, drafts: draftsView }[page] || todayView)()}</main>
    <footer>日知 <span>·</span> 把日子过成自己的学问 <span class="footer-right">一日一知，一生有光。</span></footer></div>`;
}

function todayView() {
  const s = stats(data), today = dayKey(), journal = data.journals.find(x => x.date === today), dayEntries = data.entries.filter(x => x.date === today), steps = [!!journal, dayEntries.length > 0, dayEntries.some(x => x.opinion || x.rule)], done = steps.filter(Boolean).length;
  const rotation = DOMAINS[1 + ((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 5)];
  return `<section class="page-intro"><div><div class="eyebrow">A LITTLE EVERY DAY</div><h1>又是可以生长的一天<span class="title-dot">。</span></h1><p>你好，${esc(data.profile.name)}。不必知道所有答案，今天比昨天多懂一点就好。</p></div><div class="intro-seal">日<br>日<br>新</div></section>
  <section class="today-layout"><div class="today-main"><article class="daily-card"><div class="card-eyebrow"><span>${icon('sun')} 今日小课题</span><span class="pill">${data.profile.dailyMinutes} 分钟，留给自己</span></div><h2>把看见的，变成看懂的。</h2><p class="daily-desc">一段生活，一件新知，一个自己的想法。<br>不用写得漂亮，真实就很有分量。</p><div class="daily-bottom">${btn('开始今天的记录 ' + icon('arrow'), 'journal', 'cream')}<span>完成 ${done} / 3 件小事</span></div><div class="plant-art" aria-hidden="true"><svg viewBox="0 0 230 230"><circle cx="123" cy="112" r="90" fill="#ffffff" opacity=".045"/><path d="M119 204c-4-44 16-92 8-151" fill="none" stroke="#b6cba6" stroke-width="2"/><path d="M125 156c-53-2-69-30-64-55 32 1 65 16 64 55Z" fill="#8caa89"/><path d="M126 116c42-4 65-32 59-63-34 9-60 28-59 63Z" fill="#c3d0a5"/><path d="M127 84C92 75 86 45 96 26c25 12 36 33 31 58Z" fill="#a6bd98"/><path d="M124 185c40 0 67-23 68-50-33-2-63 17-68 50Z" fill="#6c947a"/><path d="m70 112 55 43m50-90-48 50M101 39l25 43m52 65-54 38" stroke="#386450" fill="none" opacity=".5"/><ellipse cx="119" cy="211" rx="44" ry="5" fill="#153a2b" opacity=".25"/></svg></div></article>
  <div class="section-heading"><h2>今天，慢慢完成这三件事</h2><span>每一步，都算数</span></div><div class="ritual-list">
  ${[['01', '留住今天', '记录经历与感受，给生活留一个坐标。', 'pen', 'journal', '约 3 分钟'], ['02', '认识一点世界', '收藏一条值得理解的信息，附上来源。', 'globe', 'capture', '约 5 分钟'], ['03', '长出一个想法', '用自己的话解释：为什么？对我有什么启发？', 'spark', 'think', '约 5 分钟']].map(([n, title, desc, i, action, time], index) => `<button class="ritual ${steps[index] ? 'complete' : ''}" data-action="${action}"><span class="ritual-num">${steps[index] ? icon('check') : n}</span><span class="ritual-copy"><strong>${title}</strong><small>${desc}</small></span><span class="ritual-time">${time}</span>${icon('arrow')}</button>`).join('')}</div>
  <div class="gentle-card"><span class="gentle-symbol">☕</span><div><strong>今天很忙？留下一句话也很好。</strong><p>两分钟记下一件事，保持和自己的连接。</p></div><button data-action="quick-journal">轻量记录 ${icon('arrow')}</button></div>
  <div class="section-heading"><h2>最近种下的想法</h2><a href="#library">去知识花园 ${icon('arrow')}</a></div><div class="recent-grid">${data.entries.slice().reverse().slice(0, 2).map(entry => entryCard(entry, true)).join('') || empty('第一颗种子，等你种下', '一条信息，加上一点自己的思考，就是一个开始。', btn('收集第一条', 'capture', 'text'))}</div>
  </div><aside class="today-aside"><article class="panel growth-overview"><div class="panel-title"><h2>一点点，正在积累</h2>${icon('leaf')}</div><div class="big-stat">${s.days}<span>天与自己相遇</span></div><div class="mini-stats"><div><strong>${s.cards}</strong><span>知识种子</span></div><div><strong>${s.understood}</strong><span>已能讲清</span></div><div><strong>${s.streak}</strong><span>连续记录</span></div></div><div class="divider"></div><div class="week-progress"><span>本周的小约定</span><strong>${s.weekDays} / ${data.profile.weeklyGoal} 天</strong></div><div class="week-dots">${Array.from({ length: 7 }, (_, i) => { const d = addDays(s.monday, i); return `<span class="${activeDates(data).includes(d) ? 'filled' : ''} ${d === today ? 'is-today' : ''}" title="${d}">${activeDates(data).includes(d) ? icon('check') : '一二三四五六日'[i]}</span>`; }).join('')}</div><p class="quiet">累计永远保留，今天随时可以重新开始。</p></article>
  <article class="panel compass"><span class="eyebrow">YOUR LEARNING COMPASS</span><h2>一处深耕，处处看见</h2><div class="focus-label">我的主修 ${icon('book')}</div><strong>${esc(data.profile.focus)}</strong><p>每周一次深入理解，<br>让知识慢慢长成自己的体系。</p><a href="#focus">继续我的主线 ${icon('arrow')}</a><div class="divider"></div><span class="focus-label">今日探索 · 轮换视角</span><strong class="rotation">${esc(rotation)}</strong><button class="text-button" data-action="domain" data-domain="${esc(rotation)}">去看一点新世界 ↗</button></article>
  <article class="reflection-note"><span class="quote-mark">“</span><p>你不必一下子成为<br>很厉害的人。<br><em>只要每天，更清楚一点。</em></p><span>给正在生长的你</span></article></aside></section>`;
}
function entryCard(e, compact = false) {
  const stages = { inbox: '待消化', thinking: '在思考', understood: '能讲清' };
  return `<button class="entry-card ${compact ? 'compact-card' : ''}" data-action="entry" data-id="${esc(e.id)}"><div class="entry-top"><span class="domain-tag">${esc(e.domain)}</span><span class="stage ${e.stage}"><i></i>${stages[e.stage]}</span></div><h3>${esc(e.title)}</h3><p>${esc(e.rule || e.opinion || e.content || '一个值得继续追问的想法。')}</p><div class="entry-bottom"><span>${labelDate(e.date)}</span><span>${e.type === 'event' ? '事件观察' : '知识笔记'} ${icon('arrow')}</span></div></button>`;
}
function heading(eyebrow, title, desc, action = '') { return `<section class="page-intro"><div><div class="eyebrow">${eyebrow}</div><h1>${title}<span class="title-dot">。</span></h1><p>${desc}</p></div>${action}</section>`; }
function journalView() {
  return `${heading('LIFE, WELL NOTICED', '生活值得被记住', '经历是理解世界的起点，感受是理解自己的线索。', btn(icon('plus') + ' 写一篇手记', 'journal'))}<div class="journal-layout"><div>${data.journals.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(j => `<article class="panel journal-card"><div class="journal-date"><strong>${labelDate(j.date)}</strong><span>${esc(j.mood || '平静')}</span><div class="journal-actions">${btn("下载 .md","export-record","text",`data-kind="journals" data-id="${esc(j.id)}"`)}<button class="text-button" data-action="journal" data-id="${esc(j.id)}">编辑</button></div></div>${[['今天经历了什么', j.experience], ['我当时的感受与想法', j.thought], ['今天带走的一句话', j.takeaway]].filter(([,v])=>v).map(([label, value])=>`<section><span class="field-caption">${label}</span><div class="md-content">${renderMarkdown(value)}</div></section>`).join('')}</article>`).join('') || empty('给今天留一个坐标', '不需要惊天动地。让你停顿的一瞬间，就值得记录。', btn('开始第一篇手记', 'journal'))}</div><aside class="panel writing-guide"><span class="eyebrow">A SMALL PRACTICE</span><h2>把注意力还给生活</h2><ol><li>写下发生了什么。<small>一个具体的场景，比抽象的感慨更珍贵。</small></li><li>辨认自己的感受。<small>可以困惑，可以平淡，也可以开心。</small></li><li>留一点给明天。<small>一个发现、一个问题，或一句提醒。</small></li></ol><div class="gentle-tip">不必每天写长篇。<br>真实的一句话，也是一篇好手记。</div></aside></div>`;
}
function libraryView() {
  const entries = data.entries.filter(e => (filter === '全部' || e.stage === filter) && (domainFilter === '全部' || e.domain === domainFilter) && `${e.title} ${e.content} ${e.fact || ''} ${e.opinion || ''} ${e.rule || ''} ${e.sourcePlatform||''} ${e.sourceAuthor||''} ${e.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase()));
  return `${heading('A GARDEN OF UNDERSTANDING', '让知识慢慢成林', '从“看过”到“想过”，再到“我能解释”。每一张卡片，都是一颗种子。', btn(icon('plus') + ' 种下一颗新知', 'capture'))}<div class="library-toolbar"><div class="tabs" role="group" aria-label="消化阶段">${[['全部','全部种子'],['inbox','待消化'],['thinking','在思考'],['understood','能讲清']].map(([id,l])=>`<button class="tab ${filter===id?'selected':''}" data-action="filter" data-filter="${id}">${l}<span>${id==='全部'?data.entries.length:data.entries.filter(e=>e.stage===id).length}</span></button>`).join('')}</div><div class="filter-controls"><select id="domain-filter" aria-label="按领域筛选"><option>全部</option>${[...new Set([...DOMAINS, data.profile.focus])].map(d=>`<option ${domainFilter===d?'selected':''}>${esc(d)}</option>`).join('')}</select><label class="search-field">${icon('search')}<input id="library-search" placeholder="搜索你的想法…" value="${esc(query)}" aria-label="搜索知识卡片"></label></div></div><div id="library-results" class="library-grid">${entries.map(e=>entryCard(e)).join('') || empty('这里还没有种子', '收集一个问题，附上来源，再试着写一点自己的理解。', btn('记录一条信息', 'capture'))}</div>`;
}
function platformHub() {
  return `<section class="platform-hub"><div class="section-heading"><div><span class="eyebrow">MANY WINDOWS, YOUR OWN VIEW</span><h2>从你常看的平台，认识世界</h2></div>${btn(icon('plus')+' 粘贴分享链接','share-import','outline')}</div><p class="platform-hint">视频、帖子、长文都能记录。打开平台发现话题，再把链接和自己的观察带回来。</p><div class="platform-grid">${SOCIAL_SOURCES.map(s=>`<article class="platform-card"><div class="platform-card-head"><span class="platform-mark ${s.tone}">${esc(s.mark)}</span><div><h3>${esc(s.name)}</h3><span>平台浏览 · 手动收藏</span></div></div><p>${esc(s.description)}</p><div class="platform-card-actions"><a href="${s.url}" target="_blank" rel="noopener noreferrer">去逛逛 ↗</a><button data-action="share-import" data-platform="${esc(s.name)}">${icon('plus')} 记一条</button></div></article>`).join('')}</div><div class="platform-reading-note">${icon('leaf')}<p>先记录“谁说了什么”，再判断“是否如此”。可以把不同平台对同一事件的说法放在一起比较。</p></div></section>`;
}
function renderHotSection() {
  const root=$('#hotboards');if(!root)return;
  const top=root.getBoundingClientRect().top;
  root.outerHTML=renderHotboards(hotSnapshot,{filter:hotFilter,expanded:hotExpanded,loading:hotLoading});
  const replacement=$('#hotboards');if(replacement&&top<80)window.scrollBy({top:replacement.getBoundingClientRect().top-top});
}
async function refreshHotboards(userInitiated=true) {
  if(hotLoading)return;hotLoading=true;renderHotSection();
  try {
    const response=await fetch('./data/hotboards.json'+(userInitiated?'?t='+Date.now():''),{cache:'no-store',signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw new Error('榜单读取失败');
    const result=await response.json();if(result?.version!==1||!Array.isArray(result.boards))throw new Error('榜单数据格式无效');
    hotSnapshot=result;if(userInitiated)toast('已读取最近发布的榜单，请留意各平台的数据时间。');
  }catch{if(userInitiated)toast('暂时无法读取新榜单，保留当前快照。');}
  finally{hotLoading=false;renderHotSection();}
}
function worldView() {
  const sourceErrors = news.errors?.length || 0;
  return `${heading('LOOK CLOSELY, THINK CLEARLY', '看见世界，也看见脉络', '从不同平台发现话题，读原文、看上下文，慢慢形成自己的判断。')}<div class="world-principle"><span>${icon('globe')}</span><div><strong>今天只挑一件事，慢一点理解。</strong><p>发生了什么 → 各方想要什么 → 规则怎样起作用 → 哪些证据能改变我的判断。</p></div>${btn('记录一个事件', 'event', 'outline')}</div>${platformHub()}${renderHotboards(hotSnapshot,{filter:hotFilter,expanded:hotExpanded,loading:hotLoading})}<div class="section-heading"><h2>每日信息窗</h2><span>${news.generatedAt ? '更新于 ' + new Date(news.generatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '等待首次资讯更新'}</span></div><p class="quiet news-disclaimer">以下是 RSS 自动整理的来源标题，未经系统核验。社交平台内容请通过上方入口浏览或粘贴链接收藏。${sourceErrors ? ` 本次 ${sourceErrors} 个信息源暂时不可用，保留条目显示原始日期。` : ''}</p><div class="news-grid">${news.items.slice(0, 18).map(n=>`<article class="panel news-card"><div class="news-meta"><span>${esc(n.source)}</span><span>${esc(n.published?.slice(0,10) || '来源未标注日期')}</span></div><h3>${esc(n.title)}</h3><div class="news-card-bottom">${sourceLink(n.url)}<button class="text-button" data-action="news-save" data-url="${esc(n.url)}">${icon('plus')} 收入花园</button></div></article>`).join('') || empty('从一个感兴趣的问题开始', '每日资讯暂未更新。你仍可以浏览上方平台，或打开下面的一手资料窗口。')}</div><div class="section-heading"><h2>再找一个资料窗口，核对一下</h2><span>原文、论文与公开数据</span></div><div class="source-grid">${[['中国新闻网','社会与公共事务','https://www.chinanews.com.cn/'],['中国政府网','政策原文与公开信息','https://www.gov.cn/'],['arXiv · 人工智能','论文与研究进展','https://arxiv.org/list/cs.AI/recent'],['Hacker News','技术与创业讨论','https://news.ycombinator.com/'],['Our World in Data','用数据理解世界','https://ourworldindata.org/'],['国家统计局','经济与社会数据','https://www.stats.gov.cn/']].map(([t,d,u])=>`<a class="source-card" href="${u}" target="_blank" rel="noopener noreferrer"><span>${t}<small>${d}</small></span>${icon('arrow')}</a>`).join('')}</div>`;
}
function shareImportModal(platform='') {
  if(!requireAccount())return;
  modal(platform?'从'+esc(platform)+'留下一条新知':'把平台上的发现，带回这里','可粘贴完整分享文案或网页链接，系统会提取第一个网页链接；多条内容请分开收藏。',`<form id="share-import-form"><label>分享文字或链接<textarea name="shared" required rows="4" maxlength="12000" placeholder="例如：复制抖音、小红书、B 站的分享内容，粘贴到这里…"></textarea></label><div id="share-detected" class="share-detected" role="status">等待粘贴链接 · 不会自动抓取视频或帖子正文</div><div class="form-row"><label>来源平台<select name="platform"><option value="">识别链接 / 其他来源</option>${SOCIAL_SOURCES.map(s=>`<option ${platform===s.name?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label>${inputField('作者 / 账号（选填）','author','记住这是谁的说法')}</div>${inputField('给这条发现起个标题','title','你最想留住的那个问题或观点','',true)}${inputField('我想记住的要点（选填）','summary','视频讲了什么？哪些是事实，哪些是作者观点？','',false,true)}<p class="form-error" role="alert"></p><button type="submit" class="btn primary full">带到写作间，继续整理 ${icon('arrow')}</button><p class="quiet">平台页面可能需要在平台内登录。这里保存链接和你填写的笔记，不代表已核实原内容。</p></form>`,true);
}


const curriculum = [
  ['建立地图', '计算机与 AI 的全貌', ['计算、数据与算法如何连接', '机器学习、深度学习、大模型的关系', '给一位非专业朋友画一张 AI 地图']],
  ['打好地基', '从数据到模型', ['训练集、验证集与数据泄漏', '损失函数、优化与泛化', '用一个小实验解释过拟合']],
  ['理解核心', '走进大模型', ['注意力与 Transformer', '预训练、微调与推理', '讲清一个模型的能力和边界']],
  ['走向系统', '把模型用起来', ['检索增强与评估', '推理效率、显存与计算', '做一个可复现的小项目']],
  ['形成判断', '研究、产业与社会', ['论文证据与基准的局限', '产业链、成本和激励', '写一篇有证据、有反例的专题解释']],
];
function focusView() {
  const entries = data.entries.filter(e=>e.domain===data.profile.focus), understood = entries.filter(e=>e.stage==='understood').length;
  const isAI = data.profile.focus === DOMAINS[0];
  return `${heading('DEPTH MAKES A DIFFERENCE', '给好奇心一条主线', '广泛地看世界，也在一个领域里扎下根。主修的进度，由你真正理解了什么决定。', btn('调整主修', 'settings', 'outline'))}<article class="focus-hero"><div><span class="eyebrow">我的长期主修</span><h2>${esc(data.profile.focus)}</h2><p>积累 ${entries.length} 张卡片 · ${understood} 个能解释的知识点 · ${data.projects.filter(p=>p.done).length} 项完成的实践</p><div class="focus-actions">${btn(icon('plus')+' 记主修笔记','focus-note')}${btn('添加一个实践课题','project','outline')}</div></div><span class="focus-hero-art">${icon('layers')}</span></article><div class="section-heading"><h2>${isAI?'五个阶段，走出自己的理解':'用五个阶段搭起你的领域地图'}</h2><span>按自己的节奏，无需逐日赶进度</span></div><div class="curriculum">${(isAI ? curriculum : [['建立地图','看见领域全貌',['核心问题是什么','有哪些关键概念与分支','画一张领域地图']],['打好地基','理解基础概念',['找一本可靠的入门资料','用自己的话解释关键概念','记录一个反直觉的发现']],['理解核心','分析典型案例',['找一个领域代表案例','分开记录证据和解释','指出案例的适用边界']],['走向实践','动手验证一次',['提出一个小问题','收集数据或做一次实践','写下结果与原来预期的差异']],['形成判断','输出自己的解释',['整理核心观点与证据','主动寻找反例','形成一篇专题说明']]]).map(([phase,title,tasks],i)=>`<article class="panel curriculum-card"><div class="phase-number">0${i+1}</div><div><span class="field-caption">${phase}</span><h3>${title}</h3><ul>${tasks.map(t=>`<li>${t}</li>`).join('')}</ul></div><button class="text-button" data-action="topic" data-topic="${esc(title)}">写学习笔记 ${icon('arrow')}</button></article>`).join('')}</div><div class="section-heading"><h2>用作品证明理解</h2>${btn(icon('plus')+' 新建课题','project','text')}</div><div class="project-list">${data.projects.map(p=>`<article class="panel project-row"><button class="project-check ${p.done?'checked':''}" data-action="project-toggle" data-id="${esc(p.id)}" aria-label="${p.done?'标记为未完成':'标记为完成'}">${p.done?icon('check'):''}</button><div><h3>${esc(p.title)}</h3><p>${esc(p.description || '一个小而具体、能够完成的实践。')}</p></div><button class="text-button danger" data-action="project-delete" data-id="${esc(p.id)}" aria-label="删除课题 ${esc(p.title)}">删除</button></article>`).join('') || empty('从一个小问题开始实践', '例如：实现一个简单的检索工具，并记录它什么时候会答错。', btn('添加我的第一个课题','project','text'))}</div><div class="section-heading"><h2>主修笔记</h2><a href="#library">查看全部 ${icon('arrow')}</a></div><div class="library-grid">${entries.slice().reverse().slice(0,6).map(e=>entryCard(e)).join('') || empty('把学习过程留在这里','笔记不用面面俱到，先记下自己真正想明白的一点。')}</div>`;
}
function reviewView() {
  const due = data.entries.filter(e=>e.stage!=='inbox' && e.nextReview<=dayKey()), s = stats(data);
  return `${heading('RECALL, REFINE, EXPRESS', '回头看看，才能走得更深', '先不看答案，试着说清；允许自己忘记，也允许观点改变。', btn('写本周复盘','weekly'))}<div class="review-summary"><article class="panel"><span>今日待回想</span><strong>${due.length}<small>张卡片</small></strong><p>按 1、3、7、14、30、90 天逐步回看。</p></article><article class="panel"><span>本周留下的足迹</span><strong>${s.weekDays}<small>天</small></strong><p>完成了什么，比错过了什么更值得看见。</p></article><article class="panel"><span>累计周复盘</span><strong>${data.reviews.length}<small>次</small></strong><p>每周留下一段自己的解释。</p></article></div><div class="section-heading"><h2>给过去的想法，浇一点水</h2><span>先回想，再翻开</span></div><div class="review-list">${due.map(e=>`<article class="panel review-card"><div><span class="domain-tag">${esc(e.domain)}</span><h3>${esc(e.title)}</h3><p>${esc(e.question || '如果向没有背景知识的人解释，你会怎么说？')}</p></div><button class="btn outline" data-action="recall" data-id="${esc(e.id)}">开始回想 ${icon('arrow')}</button></article>`).join('') || empty('今天暂时没有到期的卡片', '把知识卡片从“待消化”推进到“在思考”后，就会进入回想计划。', btn('去整理知识卡片','library','text'))}</div><div class="section-heading"><h2>每周一次，把见解说清楚</h2><span>一个观点 + 一个证据 + 一个边界</span></div><article class="expression-card"><div>${icon('pen')}<h2>这周，我对什么有了新的理解？</h2><p>选择一个问题，用 200—500 字说明你的判断。<br>写给未来的自己，也写给一个愿意听的朋友。</p>${btn('写下本周的理解 '+icon('arrow'),'weekly')}</div><div class="expression-steps"><p><b>01</b> 我原来怎么想？</p><p><b>02</b> 什么证据改变了我？</p><p><b>03</b> 我现在怎么解释？</p><p><b>04</b> 在什么情况下不成立？</p></div></article><div class="section-heading"><h2>过去的回望</h2></div>${data.reviews.slice().reverse().map(r=>`<article class="panel weekly-card"><span class="field-caption">${labelDate(r.date)} · 每周复盘</span><h3>${esc(r.title || '这一周的新理解')}</h3>${[['原来的想法',r.before],['新的证据',r.evidence],['现在的解释',r.insight],['边界与反例',r.boundary],['下周的小问题',r.next]].filter(([,v])=>v).map(([l,v])=>`<section><span class="field-caption">${l}</span><div class="md-content">${renderMarkdown(v)}</div></section>`).join('')}<div class="button-row">${btn("下载 .md","export-record","text",`data-kind="reviews" data-id="${esc(r.id)}"`)}<button class="text-button" data-action="weekly" data-id="${esc(r.id)}">继续修改</button></div></article>`).join('')}`;
}
function growthView() {
  const s = stats(data), days = activeDates(data), today = dayKey(), end = addDays(today, 6 - ((new Date(`${today}T12:00:00Z`).getUTCDay()+6)%7)), start = addDays(end,-181);
  const domains = [...new Set([...DOMAINS, data.profile.focus, ...data.entries.map(e=>e.domain)])];
  return `${heading('EVERY SMALL STEP COUNTS','你走过的路，都在这里','积累的意义，是慢慢拥有自己的解释。空白的一天，不会抹去已经走过的路。')}<div class="growth-stats">${[[s.days,'天真实记录','每一天都算数'],[s.cards,'颗知识种子','从好奇开始'],[s.understood,'个能解释的知识点','从输入走向理解'],[data.reviews.length,'篇自己的见解','让想法有据可循']].map(([v,t,d])=>`<article class="panel"><strong>${v}</strong><h3>${t}</h3><p>${d}</p></article>`).join('')}</div><article class="panel heatmap-panel"><div class="panel-title"><h2>近半年的生长痕迹</h2><span>${s.days} 天积累 · 连续 ${s.streak} 天</span></div><div class="heatmap-scroll"><div class="heatmap" aria-label="近 26 周记录热力图">${Array.from({length:182},(_,i)=>{const d=addDays(start,i), count=data.entries.filter(e=>e.date===d).length+data.journals.filter(e=>e.date===d).length+data.reviews.filter(e=>e.date===d).length;return `<span class="heat-cell level-${Math.min(count,3)} ${d>today?'future':''}" title="${d}：${count} 条记录" aria-label="${d}：${count} 条记录"></span>`;}).join('')}</div></div><div class="heatmap-legend"><span>${labelDate(start)} — ${labelDate(today)}</span><span>少 <i class="level-0"></i><i class="level-1"></i><i class="level-2"></i><i class="level-3"></i> 多</span></div></article><div class="growth-columns"><article class="panel"><div class="panel-title"><h2>知识版图</h2>${icon('globe')}</div>${domains.map(d=>{ const count=data.entries.filter(e=>e.domain===d).length;return `<div class="domain-progress"><div><span>${esc(d)}</span><strong>${count} 张</strong></div><div class="progress-track"><span style="width:${s.cards?Math.round(count/s.cards*100):0}%"></span></div></div>`;}).join('')}<p class="quiet">深度与广度一起生长。主修可以多一点，其他方向不必面面俱到。</p></article><article class="panel milestones"><div class="panel-title"><h2>沿途的小里程碑</h2>${icon('spark')}</div>${[[s.days>=1,'迈出第一步','完成第一天记录'],[s.days>=7,'七次相遇','累计记录 7 天'],[s.understood>=10,'开始言之有物','积累 10 张“能讲清”的卡片'],[data.reviews.length>=4,'有自己的解释','完成 4 次周复盘'],[s.days>=30,'日积，月累','累计记录 30 天'],[data.projects.some(p=>p.done),'让理解落地','完成一个实践课题']].map(([done,title,desc])=>`<div class="milestone ${done?'earned':''}"><span>${icon(done?'check':'leaf')}</span><div><strong>${title}</strong><small>${desc}</small></div>${done?'<b>已点亮</b>':''}</div>`).join('')}</article></div>`;
}
function settingsView() {
  return `${heading('MAKE ROOM FOR YOURSELF','把空间调成自己的节奏','你决定学什么、走多快。这里为你保管每一个认真生活的片段。')}<div class="settings-grid"><article class="panel"><h2>我的小约定</h2><form id="profile-form"><label>怎么称呼你<input name="name" required maxlength="30" value="${esc(data.profile.name)}"></label><label>我的长期主修<input name="focus" required maxlength="60" value="${esc(data.profile.focus)}" list="domain-options"><datalist id="domain-options">${DOMAINS.map(d=>`<option value="${esc(d)}">`).join('')}</datalist></label><label>每周想记录几天<select name="weeklyGoal">${[2,3,4,5,6,7].map(n=>`<option value="${n}" ${data.profile.weeklyGoal===n?'selected':''}>${n} 天</option>`).join('')}</select></label><label>每天给自己留多久<select name="dailyMinutes">${[2,5,10,15,20,30].map(n=>`<option value="${n}" ${data.profile.dailyMinutes===n?'selected':''}>${n} 分钟</option>`).join('')}</select></label><button class="btn primary" type="submit">保存我的节奏</button></form></article><div><article class="panel backup-panel"><h2>给积累留一份备份</h2><p>日记和卡片用你的密码加密，保存在当前浏览器。更换设备、清理浏览器前，请导出加密备份。</p><div class="button-stack">${btn(icon('download')+' 导出加密备份','export')}${btn('从加密备份恢复','import','outline')}${btn('导出为 Markdown（可读明文）','markdown','text')}</div><p class="quiet">密码无法找回，请妥善保管。系统不会将私人内容上传到公开网站。</p></article><article class="panel cloud-panel"><h2>跨设备同步 · 私有 GitHub 仓库</h2><p>可选功能：在你自己的私有仓库保存一份加密快照。在另一台设备使用相同仓库、令牌与密码恢复。</p><form id="cloud-form"><label>私有仓库（账号/仓库名）<input name="repo" required placeholder="hblgzsx/rizhi-private" value="${esc(cloudTarget)}" pattern="[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+"></label><label>Fine-grained 访问令牌<input type="password" name="token" autocomplete="off" placeholder="仅允许该私有仓库 Contents 读写" required value="${esc(cloudToken)}"></label><p class="quiet">令牌仅留在当前页面内存，锁定后清除。系统先校验仓库为私有，上传内容仍为加密数据。首次上传前会检查远端版本，存在差异时需先下载恢复。</p><div class="button-row"><button class="btn primary" type="submit" value="push">上传加密快照</button><button class="btn outline" type="submit" value="pull">下载并恢复</button></div><p id="cloud-status" role="status"></p></form></article></div></div>`;
}

function modal(title, subtitle, content, wide = false) {
  if (/<form id="(?:journal|entry|weekly)-form"/.test(content)) { openWriter(title,subtitle,content); return; }
  flushDraft(); currentDraftKey = ''; editorDirty = false;
  lastFocus = document.activeElement;
  $('#modal-root').innerHTML = `<div class="modal-overlay"><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="modal-close icon-button" data-action="close" aria-label="关闭">${icon('close')}</button><div class="eyebrow">RIZHI · PERSONAL SPACE</div><h2 id="modal-title">${title}</h2><p class="modal-subtitle">${subtitle}</p>${content}</section></div>`;
  document.body.classList.add('modal-open'); enhanceEditor(); setTimeout(()=>$('#modal-root input:not([type="file"]), #modal-root textarea, #modal-root button[type="submit"], #modal-root .modal-close')?.focus(), 50);
}
function closeModal() {
  if (!$('#modal-root').children.length && writerState) { exitWriter(); return; }
  flushDraft(); currentDraftKey=''; editorDirty=false; $('#modal-root').innerHTML=''; document.body.classList.remove('modal-open');
  const form=$('#writer-root form');if(form)currentDraftKey=draftKeyFor(form);
  lastFocus?.focus();
}

function draftKeyFor(form) {return form.dataset.draftId ||= uid();}
function openWriter(title,subtitle,content) {
  flushDraft(); currentDraftKey='';editorDirty=false;
  const from=writerState?.from || (page.startsWith('write/') ? 'library' : page);
  const holder=document.createElement('div');holder.innerHTML=content;
  const form=$('form',holder),kind={'journal-form':'journal','entry-form':'entry','weekly-form':'weekly'}[form.id];
  prepareDraftForm(form);
  const draftId=draftKeyFor(form);
  const route=`write/${kind}/${form.dataset.id||'new'}/draft/${draftId}${form.dataset.quick==='true'?'/quick':''}`;
  writerState={from,route,kind,draftId};
  $('#modal-root').innerHTML='';document.body.classList.remove('modal-open');document.body.classList.add('writer-open');
  const label={journal:'生活手记',entry:'知识笔记',weekly:'每周复盘'}[kind];
  $('#writer-root').innerHTML=`<section class="writer-page"><header class="writer-topbar"><div class="writer-top-left"><button class="writer-back" data-action="close" aria-label="保存草稿并返回">${icon('arrow')}<span>返回</span></button><a class="writer-brand" href="#today">${icon('book')}日知<span>/</span><small>写作间</small></a></div><div class="writer-top-actions">${themeButton()}<span id="writer-status">${icon('lock')}草稿自动加密保存</span><button class="btn outline" data-action="writer-preview">${icon('book')}<span>全文预览</span></button><button class="btn outline writer-download" data-action="export-current">${icon('download')}<span>导出 .md</span></button><button class="btn primary" data-action="writer-save" type="submit" form="${form.id}">${icon('check')}<span>保存笔记</span></button></div></header><main id="writer-main" class="writer-main" tabindex="-1"><div class="writer-intro"><div><span class="eyebrow">A QUIET PLACE TO THINK</span><h1>${title}<span>。</span></h1><p>${subtitle}</p></div><div class="writer-type">${icon(kind==='journal'?'pen':kind==='entry'?'leaf':'refresh')}<span>${label}</span></div></div><div id="writer-form-slot"></div><section class="writer-full-preview" hidden aria-label="全文预览"><div class="writer-preview-heading"><span class="eyebrow">READ YOUR OWN WORDS</span><span>你的文字，慢慢有了形状</span></div><article class="md-content"></article></section><div class="writer-bottom-note"><span>日有所记，知有所长。</span><span>Ctrl / ⌘ + S 保存 · Markdown 写作</span></div></main></section>`;
  $('#writer-form-slot').append(form);
  const sourcePlatform=form.elements.namedItem('sourcePlatform');
  if(sourcePlatform){const originalPlatform=form.dataset.originalPlatform;if(originalPlatform&&![...sourcePlatform.options].some(option=>option.value===originalPlatform)){sourcePlatform.add(new Option(originalPlatform,originalPlatform));sourcePlatform.value=originalPlatform;}}
  enhanceEditor();
  form.classList.add('writer-form');
  const fields=document.createElement('div');fields.className='writer-fields';
  const rail=document.createElement('aside');rail.className='writer-rail';rail.setAttribute('aria-label','笔记信息');
  const railHeading=document.createElement('div');railHeading.className='writer-rail-heading';railHeading.innerHTML=`<span>${icon('layers')}笔记信息</span><small>给想法一个位置</small>`;rail.append(railHeading);
  const titleField=form.elements.namedItem('title');
  if(titleField){const labelEl=titleField.closest('label');labelEl.classList.add('writer-title-field');fields.append(labelEl);titleField.placeholder=kind==='weekly'?'这周，我多懂了一点什么？':'为这一页，写一个标题…';titleField.setAttribute('aria-label','笔记标题');}
  const primaryName={journal:'experience',entry:'content',weekly:'insight'}[kind];
  const primary=form.elements.namedItem(primaryName)?.closest('label');
  if(primary){primary.classList.add('writer-primary-field');fields.append(primary);}
  const draftNote=$('.draft-status',form);if(draftNote)fields.prepend(draftNote);
  const metaNames={journal:['date','mood'],entry:['domain','type','stage','tags','source','sourcePlatform','sourceAuthor'],weekly:['next']}[kind];
  for(const name of metaNames){const field=form.elements.namedItem(name)?.closest('label');if(field)rail.append(field);}
  const supplement=document.createElement('div');supplement.className='writer-supplement';
  for(const node of [...form.children]){
    if(node.classList.contains('form-row')){for(const child of [...node.children])supplement.append(child);node.remove();}
    else if(node.matches('label, details'))supplement.append(node);
  }
  if(supplement.children.length){const h=document.createElement('h2');h.className='writer-section-title';h.textContent=kind==='journal'?'留一点感受，给未来的自己':kind==='entry'?'再想深一点':'让这次理解，有来有往';fields.append(h,supplement);}
  const error=$('.form-error',form);if(error)fields.append(error);
  const footer=$('.form-footer',form);if(footer)fields.append(footer);
  const exportRow=$('.editor-local-export',form);if(exportRow)exportRow.remove();
  rail.insertAdjacentHTML('beforeend',`<div class="writer-rail-tip">${icon('leaf')}<p>先把想法写下来。<br>不必一开始就很完整。</p><span>文字会在一次次回看中，<br>长出自己的分量。</span></div><div class="writer-shortcuts"><span><kbd>Ctrl</kbd> + <kbd>S</kbd> 保存</span><span><kbd>Ctrl</kbd> + <kbd>B</kbd> 粗体</span><span><kbd>Ctrl</kbd> + <kbd>I</kbd> 斜体</span></div>`);
  form.append(fields,rail);
  const sourceField=form.elements.namedItem('source');if(sourceField)sourceField.maxLength=4000;
  if(!form.dataset.id&&!data.drafts?.[currentDraftKey]&&[...form.querySelectorAll('[name="title"], textarea')].some(field=>field.value.trim())){editorDirty=true;draftTimer=setTimeout(flushDraft,700);}
  // Start long-form writing with a wide, roomy source editor.
  const mainEditor=primary?.querySelector('.md-editor');if(mainEditor){mainEditor.dataset.mode='edit';mainEditor.querySelectorAll('.md-modes button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode==='edit')));}
  if(location.hash!==`#${route}`)history.pushState({writerFrom:from},'',`#${route}`);
  page=route;document.title=`${label} · 日知写作间`;
  $('.skip-link').href='#writer-main';window.scrollTo({top:0});
  const initialField=titleField||form.elements.namedItem(primaryName);initialField?.focus({preventScroll:true});
}
function removeWriter() {
  flushDraft();currentDraftKey='';editorDirty=false;writerState=null;$('#writer-root').innerHTML='';document.body.classList.remove('writer-open','writer-previewing');$('.skip-link').href='#main';
}
async function exitWriter() {
  const destination=writerState?.from||'library';flushDraft();
  try {await saveQueue;}catch{toast('草稿尚未保存成功，请先导出当前内容后再离开。');return;}
  removeWriter();history.replaceState(null,'',`#${destination}`);page=destination;render();window.scrollTo({top:0});
}
function routeWriter(route) {
  const [,kind,id,mode,draftId,quick]=route.split('/');
  if(!['journal','entry','weekly'].includes(kind)||!id||!/^(new|[A-Za-z0-9-]{1,80})$/.test(id)){history.replaceState(null,'','#today');page='today';render();return;}
  if(preview){pendingWriterRoute=route;page='today';render();authModal();return;}
  if(mode==='draft'&&draftId&&data.drafts?.[draftId]){openDraft(draftId,false);return;}
  if(mode==='draft'&&draftId&&/^[A-Za-z0-9-]{1,80}$/.test(draftId))draftToResume={id:draftId,kind,recordId:id==='new'?'':id,quick:quick==='quick',fields:{}};
  const recordId=id==='new'?undefined:id;
  if(recordId&&!({journal:data.journals,entry:data.entries,weekly:data.reviews}[kind]).some(r=>r.id===recordId)){draftToResume=null;toast('这篇记录不存在或已被删除。');history.replaceState(null,'','#library');page='library';render();return;}
  if(kind==='journal')journalModal(recordId,mode==='quick'||quick==='quick');else if(kind==='entry')captureModal({id:recordId});else weeklyModal(recordId);
}
function previewWriter() {
  const form=$('#writer-root form');if(!form)return;
  const enabled=!document.body.classList.contains('writer-previewing');
  if(enabled){const values=formDraft(form),kind={'journal-form':'journals','entry-form':'entries','weekly-form':'reviews'}[form.id],old=data[kind].find(r=>r.id===form.dataset.id)||{};
    const record={...old,...values,date:values.date||old.date||dayKey(),title:values.title||'未命名笔记'};
    if(kind==='entries')record.tags=String(values.tags||'').split(/[,，]/).map(t=>t.trim()).filter(Boolean);
    const markdown=recordMarkdown(kind,record,{name:data.profile.name}).replace(/  \n导出时间：[^\n]*\n/,'\n');
    $('.writer-full-preview article').innerHTML=renderMarkdown(markdown);
  }
  document.body.classList.toggle('writer-previewing',enabled);$('.writer-full-preview').hidden=!enabled;$('#writer-form-slot').hidden=enabled;
  const button=$('[data-action="writer-preview"]');$('span',button).textContent=enabled?'返回编辑':'全文预览';button.setAttribute('aria-pressed',String(enabled));window.scrollTo({top:0});
}
function authModal(mode) {
  const exists = !!localStorage.getItem(VAULT_KEY), login = mode !== 'create' && exists;
  modal(login?'欢迎回到自己的空间':'从今天，开始积累', login?'输入密码，继续昨天种下的想法。':'给自己一处安静的角落。每天一点，慢慢生长。', `<form id="auth-form" data-login="${login}">${!login?'<label>怎么称呼你<input name="name" required maxlength="30" placeholder="你的名字或昵称" autocomplete="nickname"></label>':''}<label>${login?'空间密码':'设置空间密码（至少 10 位）'}<input name="password" type="password" required minlength="${login?1:10}" maxlength="200" autocomplete="${login?'current-password':'new-password'}" placeholder="${login?'输入你的密码':'请使用一个能记住的长密码'}"></label>${!login?'<label>再输入一次<input name="confirm" type="password" required minlength="10" maxlength="200" autocomplete="new-password" placeholder="确认密码"></label>':''}<p class="form-error" role="alert"></p><button class="btn primary full" type="submit">${login?'解锁我的空间':'开启我的第一天'} ${icon('arrow')}</button></form><div class="auth-note">${icon('lock')}<span>密码用于加密私人记录，无法找回。记录保存在此设备，可导出备份或连接私有仓库。离开页面或闲置 15 分钟后自动锁定。</span></div><button class="text-button auth-import" data-action="import">在新设备上？从加密备份恢复</button>`);
}
function inputField(label, name, placeholder = '', value = '', required = false, textarea = false) { return `<label>${label}${textarea?`<textarea name="${name}" rows="3" maxlength="20000" ${required?'required':''} placeholder="${esc(placeholder)}">${esc(value)}</textarea>`:`<input name="${name}" maxlength="300" ${required?'required':''} placeholder="${esc(placeholder)}" value="${esc(value)}">`}</label>`; }
function journalModal(id, quick = false) {
  if (!requireAccount()) return;
  const j = data.journals.find(x=>x.id===id) || (!id && !draftToResume && data.journals.find(x=>x.date===dayKey()));
  modal(quick?'一句话，也值得留下':j?'继续今天的手记':'给今天留一点文字', '不用写成文章，先把真实的自己留在这里。', `<form id="journal-form" data-id="${j?.id || ''}" data-quick="${quick}"><div class="form-row"><label>记录日期<input type="date" name="date" required max="${dayKey()}" value="${j?.date || dayKey()}"></label><label>此刻的心情<select name="mood">${['平静','开心','充实','疲惫','困惑','难过','期待'].map(m=>`<option ${j?.mood===m?'selected':''}>${m}</option>`).join('')}</select></label></div>${inputField('今天经历了什么','experience',quick?'用一句话说说今天。':'一个场景、一段对话，或一件微小的事。',j?.experience,true,true)}${quick?'':inputField('我的感受与想法','thought','我为什么会有这样的感受？',j?.thought,false,true)+inputField('今天带走的一句话','takeaway','今天学到、想明白，或想提醒自己的一件事。',j?.takeaway,false,true)}<p class="form-error" role="alert"></p><div class="form-footer">${j?btn('删除手记','journal-delete','text danger',`data-id="${j.id}"`):'<span class="quiet">真实就很好。</span>'}<button class="btn primary" type="submit">保存今天 ${icon('check')}</button></div></form>`,true);
}
function captureModal(options = {}) {
  if (!requireAccount()) return;
  const e = data.entries.find(x=>x.id===options.id), value = e || options;
  modal(e?'照料这颗知识种子':options.type==='event'?'理解一件事，从事实开始':'种下一颗新的好奇心', '先留下值得记住的，再慢慢长出自己的理解。', `<form id="entry-form" data-id="${e?.id || ''}" data-source-platform="${esc(value.sourcePlatform||detectPlatform(value.source))}">${inputField('标题','title','给这件事或这个想法起个名字',value.title,true)}<div class="form-row"><label>所属领域<select name="domain">${[...new Set([...DOMAINS,data.profile.focus])].map(d=>`<option ${value.domain===d?'selected':''}>${esc(d)}</option>`).join('')}</select></label><label>记录类型<select name="type"><option value="knowledge" ${value.type!=='event'?'selected':''}>知识笔记</option><option value="event" ${value.type==='event'?'selected':''}>事件观察</option></select></label></div>${inputField('来源链接','source','支持抖音、微博、B 站、小红书等分享链接',value.source)}<div class="form-row"><label>来源平台<select name="sourcePlatform"><option value="">自动识别 / 其他来源</option>${SOCIAL_SOURCES.map(s=>`<option ${(value.sourcePlatform||detectPlatform(value.source))===s.name?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label>${inputField('作者 / 账号','sourceAuthor','原作者或发布账号（选填）',value.sourceAuthor)}</div>${inputField('我收集到的信息','content','用自己的话记要点，不必复制整篇文章。',value.content,false,true)}<div class="form-row"><label>消化阶段<select name="stage"><option value="inbox" ${value.stage==='inbox'?'selected':''}>待消化 · 先收进来</option><option value="thinking" ${value.stage==='thinking'?'selected':''}>在思考 · 有疑问或初步理解</option><option value="understood" ${value.stage==='understood'?'selected':''}>能讲清 · 有解释、有证据、有边界</option></select></label>${inputField('标签（逗号分隔）','tags','例：大模型，产业观察',value.tags?.join('，'))}</div><details class="thinking-fields" ${e || options.type==='event' || options.expand?'open':''}><summary>${icon('spark')} 多想一步：把信息变成见解</summary><div class="thinking-prompt">事件观察时，可从参与者、利益、规则、成本和信息差入手。结论先作为假设，给反例留位置。</div>${inputField('已确认的事实与证据','fact','什么确实发生了？依据是什么？哪些仍待核实？',value.fact,false,true)}${inputField('我目前的解释','opinion','为什么会这样？我的判断是什么？',value.opinion,false,true)}${inputField('适用边界与反例','boundary','什么情况下不成立？什么新证据会让我改变判断？',value.boundary,false,true)}${inputField('提炼出的规律 / 与已有知识的连接','rule','这件事让我理解了什么？它和过去哪个经验相关？',value.rule,false,true)}${inputField('想继续追问的问题','question','下一步想弄明白什么？',value.question,false,true)}</details><p class="form-error" role="alert"></p><div class="form-footer">${e?btn('删除卡片','entry-delete','text danger',`data-id="${e.id}"`):'<span class="quiet">保留疑问，也是进步。</span>'}<button class="btn primary" type="submit">${e?'保存新的理解':'种下这颗种子'} ${icon('check')}</button></div></form>`,true);
}
function entryModal(id) {
  const e=data.entries.find(x=>x.id===id); if(!e)return;
  modal(esc(e.title),`${esc(e.domain)} · ${labelDate(e.date)}`,`<div class="entry-detail">${sourceLink(e.source)}${e.sourcePlatform||e.sourceAuthor?`<p class="source-attribution">${esc(e.sourcePlatform||detectPlatform(e.source)||'其他来源')}${e.sourceAuthor?' · '+esc(e.sourceAuthor):''}</p>`:''}${[['收集的信息',e.content],['事实与证据',e.fact],['我目前的解释',e.opinion],['边界与反例',e.boundary],['规律与连接',e.rule],['继续追问',e.question]].filter(([,v])=>v).map(([t,v])=>`<section><h3>${t}</h3><div class="md-content">${renderMarkdown(v)}</div></section>`).join('')}<div class="tags">${e.tags.map(t=>`<span># ${esc(t)}</span>`).join('')}</div><div class="form-footer"><span class="quiet">${e.stage==='inbox'?'整理后进入回想计划':'下次回想：'+e.nextReview}</span>${btn('下载此篇 .md','export-record','outline',`data-kind="entries" data-id="${esc(e.id)}"`)}${btn('继续思考 '+icon('pen'),'edit-entry','primary',`data-id="${esc(e.id)}"`)}</div></div>`,true);
}
function weeklyModal(id) {
  if(!requireAccount())return; const r=data.reviews.find(x=>x.id===id) || {};
  modal('这周，我多懂了一点什么？','选一个问题说清楚，比总结一大堆信息更有价值。',`<form id="weekly-form" data-id="${r.id||''}">${inputField('本周想解释的问题','title','一个具体、值得解释的问题',r.title,true)}${inputField('我原来怎么想','before','当时的判断与依据是什么？',r.before,false,true)}${inputField('什么证据改变或支持了我','evidence','链接、事实、数据或亲身经历。',r.evidence,false,true)}${inputField('我现在怎么解释','insight','用自己的话说，像讲给朋友听。',r.insight,true,true)}${inputField('边界与反例','boundary','这个解释什么时候不适用？',r.boundary,false,true)}${inputField('下周只追一个小问题','next','留下一个想继续探索的问题。',r.next)}<p class="form-error" role="alert"></p><div class="form-footer"><span class="quiet">观点可以变化，思考会留下。</span><button type="submit" class="btn primary">保存本周的见解</button></div></form>`,true);
}
function recallModal(id) {
  if(!requireAccount())return; const e=data.entries.find(x=>x.id===id); if(!e)return;
  modal(esc(e.title),'给自己 30 秒，先回想，再看过去的记录。',`<div class="recall-prompt"><span class="eyebrow">试着说给一个朋友听</span><p>${esc(e.question || '这是什么？为什么重要？依据是什么？它什么时候不成立？')}</p><textarea rows="3" placeholder="在这里试着写下你的解释（仅供这次练习，不会单独保存）" aria-label="回想练习"></textarea></div><details class="recall-answer"><summary>我想过了，看看过去的记录</summary><div class="md-content">${renderMarkdown(e.opinion || e.rule || e.content)}</div>${e.fact?`<section><strong>证据</strong><div class="md-content">${renderMarkdown(e.fact)}</div></section>`:''}${e.boundary?`<section><strong>边界</strong><div class="md-content">${renderMarkdown(e.boundary)}</div></section>`:''}<div class="button-row">${btn('还不太清楚 · 明天再见','recall-no','outline',`data-id="${e.id}"`)}${btn('能解释出来 · 下次再见','recall-yes','primary',`data-id="${e.id}"`)}</div>${btn('修正这张卡片','edit-entry','text',`data-id="${e.id}"`)}</details>`,true);
}
function importModal() {
  if(!preview && !requireAccount())return;
  modal('带着积累，回到这里','选择日知导出的加密备份，并输入备份对应的密码。',`<form id="import-form"><label>加密备份文件<input name="file" type="file" accept=".json,application/json" required></label><label>备份密码<input name="password" type="password" required autocomplete="current-password"></label>${localStorage.getItem(VAULT_KEY)?'<label class="checkbox-label"><input name="overwrite" type="checkbox" required>我已备份现有空间，确认用导入的数据替换此设备的记录。</label>':''}<p class="form-error" role="alert"></p><button type="submit" class="btn primary full">验证并恢复</button></form>`);
}
function confirmDelete(kind,id) {
  if(!requireAccount())return;
  modal('删除这条记录？','删除后无法直接撤销。可以先在空间设置中导出加密备份。',`<div class="button-row">${btn('保留记录','close','outline')}${btn('确认删除','delete-confirm','danger-solid',`data-kind="${kind}" data-id="${id}"`)}</div>`);
}
function download(content,name,type='application/json') { const url=URL.createObjectURL(new Blob([content],{type})), a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
async function exportVault() {
  if(!requireAccount(true))return;
  flushDraft();
  const vault=await seal(data,key,salt);
  download(JSON.stringify(vault,null,2),exportFilename({kind:'全量加密备份',title:data.profile.name,extension:'vault.json'}));
  toast('已导出加密备份（包含草稿）。恢复时需要当前密码。');
}
function exportMarkdown() {
  if(!requireAccount(true))return;
  download('\uFEFF'+allMarkdown(data),exportFilename({kind:'全量存档',title:data.profile.name}),'text/markdown;charset=utf-8');
  toast('已下载全部正式记录的 Markdown，文件为可读明文。');
}
function exportRecord(kind,id,recordOverride) {
  if(!requireAccount(true))return;
  if(!['journals','entries','reviews'].includes(kind))return;
  const record=recordOverride || data[kind].find(r=>r.id===id);if(!record)return;
  const label={journals:'生活手记',entries:record.type==='event'?'事件观察':'知识笔记',reviews:'每周复盘'}[kind];
  const title=kind==='journals'?(record.experience.split('\n').find(x=>x.trim())||'今天的片段').replace(/^#+\s*/,''):record.title;
  const filename=exportFilename({date:record.date,kind:label,title});
  download('\uFEFF'+recordMarkdown(kind,record,{name:data.profile.name}),filename,'text/markdown;charset=utf-8');
  toast('已下载 '+filename+'（可读明文）。');
}

function editableForm() {
  if($('#modal-root .modal'))return $('#modal-root form:is(#journal-form,#entry-form,#weekly-form,#project-form)');
  return $('#writer-root form:is(#journal-form,#entry-form,#weekly-form)');
}
function formDraft(form) {
  return Object.fromEntries([...new FormData(form)].filter(([name,value])=>typeof value==='string'&&name!=='password'));
}
function prepareDraftForm(form) {
  if(form.dataset.draftReady)return;
  if(form.id==='entry-form'&&form.dataset.sourcePlatform){const field=form.elements.sourcePlatform;if(![...field.options].some(o=>o.value===form.dataset.sourcePlatform))field.add(new Option(form.dataset.sourcePlatform,form.dataset.sourcePlatform));field.value=form.dataset.sourcePlatform;}
  form.dataset.draftReady='true';
  const baseline=formDraft(form);
  if(!form.dataset.id)for(const name of ['title','content','experience','thought','takeaway','before','evidence','insight','boundary','rule','question','fact','description'])if(name in baseline)baseline[name]='';
  form.dataset.baseline=JSON.stringify(baseline);
  form.dataset.draftId=draftToResume?.id || uid();
  if(draftToResume){
    for(const [name,value] of Object.entries(draftToResume.fields||{})){
      const field=form.elements.namedItem(name);if(!field||typeof value!=='string')continue;
      if(field.tagName==='SELECT'&&![...field.options].some(option=>option.value===value))field.add(new Option(value,value));
      field.value=value;
    }
    draftToResume=null;
  }
}
function enhanceEditor() {
  const form=editableForm();if(!form)return;
  prepareDraftForm(form);currentDraftKey=draftKeyFor(form);
  if(form.dataset.enhanced)return;form.dataset.enhanced='true';
  const note=document.createElement('div');note.className='draft-status';
  note.innerHTML='<span>未完成内容会自动存入独立的草稿箱。</span><a href="#drafts">查看草稿箱 →</a>';
  form.prepend(note);
  form.querySelectorAll('textarea').forEach((textarea,index)=>{
    const editor=document.createElement('div');editor.className='md-editor';editor.dataset.mode='edit';
    const id=`md-${index}`;textarea.id=id;textarea.spellcheck=false;
    const toolbar=document.createElement('div');toolbar.className='md-toolbar';toolbar.setAttribute('role','group');toolbar.setAttribute('aria-label','Markdown 格式工具');
    toolbar.innerHTML=[['bold','B','粗体'],['italic','I','斜体'],['heading','H','标题'],['list','☷','列表'],['task','☑','待办'],['quote','❞','引用'],['code','&lt;/&gt;','代码块'],['link','↗','链接'],['table','▦','表格']].map(([format,text,label])=>`<button type="button" data-action="md-format" data-format="${format}" aria-label="${label}" title="${label}">${text}</button>`).join('')+`<span class="md-modes">${[['edit','编辑'],['split','对照'],['preview','预览']].map(([mode,label])=>`<button type="button" data-action="md-mode" data-mode="${mode}" aria-pressed="${mode==='edit'}">${label}</button>`).join('')}</span>`;
    const body=document.createElement('div');body.className='md-editor-body';textarea.parentNode.insertBefore(editor,textarea);body.append(textarea);
    const previewPane=document.createElement('div');previewPane.className='md-content md-preview';previewPane.setAttribute('aria-label','Markdown 预览');body.append(previewPane);
    const meta=document.createElement('div');meta.className='md-meta';meta.innerHTML='<span>Markdown · 标题 / 列表 / 引用 / 代码 / 表格</span><span class="md-count"></span>';
    editor.append(toolbar,body,meta);updateEditor(textarea);
  });
  if(form.id!=='project-form'){
    const row=document.createElement('div');row.className='editor-local-export';row.innerHTML=`${btn(icon('download')+' 下载当前内容 .md','export-current','text')}<span>未保存的文字也可导出 · Ctrl / ⌘ + S 保存</span>`;form.append(row);
  }
}
function updateEditor(textarea) {
  const editor=textarea.closest('.md-editor');if(!editor)return;
  $('.md-preview',editor).innerHTML=textarea.value.trim()?renderMarkdown(textarea.value):'<p class="quiet">在这里看见文字排版后的样子。</p>';
  $('.md-count',editor).textContent=`${Array.from(textarea.value).length} 字`;
}
function setEditorMode(button) {
  const editor=button.closest('.md-editor');editor.dataset.mode=button.dataset.mode;
  editor.querySelectorAll('.md-modes button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  updateEditor($('textarea',editor));if(button.dataset.mode==='edit')$('textarea',editor).focus();
}
function formatEditor(button) {
  const textarea=$('textarea',button.closest('.md-editor')),start=textarea.selectionStart,end=textarea.selectionEnd,selected=textarea.value.slice(start,end);
  const type=button.dataset.format;
  const formats={bold:['**','**','重点'],italic:['*','*','感想'],heading:['## ','','标题'],list:['- ','','一条要点'],task:['- [ ] ','','一件小事'],quote:['> ','','引用的内容'],code:['```\n','\n```','代码'],link:['[','](https://example.com)','链接文字'],table:['\n| 概念 | 理解 |\n| --- | --- |\n| ',' |  |\n','我的笔记']};
  let [before,after,fallback]=formats[type],content=selected||fallback;
  if(['heading','list','task','quote'].includes(type)){
    const lineStart=textarea.value.lastIndexOf('\n',start-1)+1;
    if(selected.includes('\n'))content=content.split('\n').join('\n'+before);
    if(start!==lineStart)before='\n'+before;
  }
  textarea.setRangeText(before+content+after,start,end,'select');textarea.focus();textarea.setSelectionRange(start+before.length,start+before.length+content.length);textarea.dispatchEvent(new Event('input',{bubbles:true}));
}
function captureDraft() {
  const form=editableForm();if(preview||!form||!currentDraftKey||!editorDirty)return false;
  const fields=formDraft(form),kind={'journal-form':'journal','entry-form':'entry','weekly-form':'weekly','project-form':'project'}[form.id];
  const written={journal:['experience','thought','takeaway'],entry:['title','content','fact','opinion','boundary','rule','question'],weekly:['title','insight','before','evidence','boundary','next'],project:['title','description']}[kind];
  editorDirty=false;data.drafts ||= {};
  const baseline=JSON.parse(form.dataset.baseline||'{}');
  const unchanged=[...new Set([...Object.keys(fields),...Object.keys(baseline)])].every(name=>(fields[name]||'')===(baseline[name]||''));
  if(!written?.some(name=>fields[name]?.trim())||unchanged){
    const existed=!!data.drafts[currentDraftKey];delete data.drafts[currentDraftKey];return existed;
  }
  const old=data.drafts[currentDraftKey],now=new Date().toISOString();
  data.drafts[currentDraftKey]={id:currentDraftKey,kind,recordId:form.dataset.id||'',quick:form.dataset.quick==='true',fields,createdAt:old?.createdAt||now,updatedAt:now};return true;
}
function flushDraft() {
  clearTimeout(draftTimer);
  if(captureDraft())persist().then(()=>{const note=$('.draft-status');if(note)note.textContent='草稿已加密保存 · 正式记录请点击保存笔记';const status=$('#writer-status');if(status)status.innerHTML=icon('check')+'草稿已加密保存';}).catch(()=>{const status=$('#writer-status');if(status)status.textContent='保存失败，请导出当前内容';});
}
function draftTitle(draft) {return draft.fields.title?.trim() || (draft.fields.experience||draft.fields.content||draft.fields.insight||draft.fields.description||'').split('\n').find(line=>line.trim())?.replace(/^#+\s*/,'').slice(0,90) || '未命名草稿';}
function draftsView() {
  const drafts=preview?[]:Object.values(data.drafts||{}).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
  return `${heading('ROOM FOR UNFINISHED THOUGHTS','让未完成的想法，有处安放','上次没写完的内容，都在这里。选一篇接着写，或另起一页。',btn(icon('plus')+' 新建笔记','capture'))}<div class="drafts-summary"><span>${icon('pen')} ${drafts.length} 份未完成草稿</span><p>草稿自动加密保存；保存为正式记录后，这一份会从草稿箱移出。</p></div><div class="drafts-grid">${drafts.map(d=>{
    const label={journal:'生活手记',entry:'知识笔记',weekly:'每周复盘',project:'实践课题'}[d.kind]||'笔记';
    const raw=d.fields.content||d.fields.experience||d.fields.insight||d.fields.description||d.fields.before||'';
    const date=d.updatedAt&&!Number.isNaN(Date.parse(d.updatedAt))?new Date(d.updatedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'旧版草稿';
    return `<article class="panel draft-card" data-draft-id="${esc(d.id)}"><div class="draft-card-meta"><span>${esc(label)}${d.quick?' · 轻量':''}</span><span>${d.recordId?'修改中的记录':'尚未正式保存'}</span></div><button class="draft-open-area" data-action="draft-open" data-id="${esc(d.id)}"><h2>${esc(draftTitle(d))}</h2><p>${esc(raw.slice(0,160)||'还留着一个等待展开的标题。')}</p></button><div class="draft-card-date">${icon('clock')} 更新于 ${esc(date)}${d.fields.date?`<span>记录日期 ${esc(d.fields.date)}</span>`:''}</div><div class="draft-card-footer">${btn('继续写 '+icon('arrow'),'draft-open','primary',`data-id="${esc(d.id)}"`)}<div>${d.kind!=='project'?btn('导出 .md','draft-export','text',`data-id="${esc(d.id)}"`):''}${btn('删除','draft-delete','text danger',`data-id="${esc(d.id)}"`)}</div></div></article>`;
  }).join('')||empty(preview?'登录后查看你的草稿':'草稿箱空空的，也很好','写到一半随时离开，未完成的内容会自动收在这里。',btn(preview?'登录我的空间':'开始写一篇',preview?'auth':'capture'))}</div>`;
}
function openDraft(id, fromInbox=true) {
  if(!requireAccount())return;
  const draft=data.drafts?.[id];if(!draft){toast('这份草稿已保存或删除。');return;}
  draftToResume=structuredClone(draft);
  const collection={journal:data.journals,entry:data.entries,weekly:data.reviews,project:data.projects}[draft.kind];
  const recordId=collection?.some(r=>r.id===draft.recordId)?draft.recordId:undefined;
  if(fromInbox)page='drafts';
  if(draft.kind==='journal')journalModal(recordId,draft.quick);
  else if(draft.kind==='entry')captureModal({id:recordId,expand:true});
  else if(draft.kind==='weekly')weeklyModal(recordId);
  else if(draft.kind==='project')projectModal();
  if(!recordId&&draft.recordId)toast('原记录已不存在，草稿将作为新记录保存。');
}
function deleteDraftModal(id) {
  if(!requireAccount()||!data.drafts?.[id])return;
  modal('删除这份草稿？','只删除所选草稿，不影响已经保存的正式记录或其他草稿。',`<div class="button-row">${btn('保留草稿','close','outline')}${btn('确认删除','draft-delete-confirm','danger-solid',`data-id="${esc(id)}"`)}</div>`);
}
async function deleteDraft(id) {
  if(!requireAccount())return;const old=data.drafts?.[id];if(!old)return;
  delete data.drafts[id];
  try {await persist();closeModal();render();toast('这份草稿已删除。');}catch{data.drafts[id]=old;}
}
function exportDraft(id) {
  if(!requireAccount(true))return;const draft=data.drafts?.[id];if(!draft)return;
  const kind={journal:'journals',entry:'entries',weekly:'reviews'}[draft.kind];if(!kind)return;
  const record={...draft.fields,id:'draft',date:draft.fields.date||dayKey(new Date(draft.createdAt||draft.updatedAt)),title:draftTitle(draft)};
  if(kind==='entries')record.tags=String(record.tags||'').split(/[,，]/).map(t=>t.trim()).filter(Boolean);
  exportRecord(kind,null,record);
}
function projectModal() {
  if(!requireAccount())return;
  modal('把理解，做成一件小事','选一个范围足够小、做完能看到结果的课题。',`<form id="project-form">${inputField('课题名称','title','例如：用一个实验解释过拟合','',true)}${inputField('怎样算完成','description','写清要交付的小成果。','',false,true)}<p class="form-error" role="alert"></p><button class="btn primary" type="submit">加入我的实践</button></form>`);
}
function exportCurrentForm() {
  const form=editableForm();if(!form)return;
  const values=formDraft(form),kind={'journal-form':'journals','entry-form':'entries','weekly-form':'reviews'}[form.id];if(!kind)return;
  const old=data[kind].find(r=>r.id===form.dataset.id)||{};
  const record={...old,...values,id:old.id||'draft',date:values.date||old.date||dayKey(),title:values.title||'未命名草稿'};
  if(kind==='entries')record.tags=String(values.tags||'').split(/[,，]/).map(t=>t.trim()).filter(Boolean);
  exportRecord(kind,null,record);
}

async function lock() {
  if(preview)return;
  flushDraft();
  try { await saveQueue; } catch { if(!conflict) { toast('保存未成功，请先导出备份再锁定。'); return; } }
  if(writerState){pendingWriterRoute=writerState.route;removeWriter();}
  key=null;salt=null;cloudToken='';cloudSha=null;cloudTarget='';conflict=false;saveFailure=null;data=structuredClone(demo);preview=true;closeModal();page='today';render();authModal();
}
async function cloudSync(form, mode) {
  if(!requireAccount())return;
  const repo=form.elements.repo.value.trim(), token=form.elements.token.value.trim();
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo))throw new Error('仓库格式应为 账号/仓库名。');
  const headers={Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
  const api=async(path,options={})=>{const res=await fetch(`https://api.github.com/repos/${repo}${path}`,{...options,headers:{...headers,...options.headers}});if(!res.ok && res.status!==404)throw new Error(`GitHub 请求失败（${res.status}），请检查令牌权限与网络。`);return res;};
  const info=await api('');if(!info.ok)throw new Error('仓库不存在或令牌无权访问。请先创建私有仓库。');if(!(await info.json()).private)throw new Error('为保护隐私，仅支持私有仓库。请先把数据仓库设为私有。');
  cloudTarget=repo;cloudToken=token;const res=await api('/contents/rizhi.vault.json'), remote=res.ok?await res.json():null;
  if(mode==='pull') {
    if(!remote)throw new Error('仓库中还没有快照，请先从原设备上传。');
    const vault=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(remote.content.replace(/\s/g,'')),c=>c.charCodeAt(0))));
    modal('恢复云端的加密快照','此操作将替换本设备的数据。未同步的记录请先导出备份。',`<form id="cloud-restore-form"><label>云端快照的密码<input type="password" name="password" required autocomplete="current-password"></label><label class="checkbox-label"><input type="checkbox" required>我已备份本地记录，确认替换。</label><p class="form-error" role="alert"></p><button class="btn primary" type="submit">解密并恢复</button></form>`);
    $('#cloud-restore-form')._remote={vault,sha:remote.sha};return;
  }
  if(remote && cloudSha!==remote.sha)throw new Error('远端已有快照或已发生更新。请先下载恢复，合并需要的记录后再上传；系统不会自动覆盖远端。');
  await persist();const vault=await seal(data,key,salt), content=btoa(JSON.stringify(vault));
  const put=await api('/contents/rizhi.vault.json',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Update encrypted Rizhi snapshot',content,...(remote?{sha:remote.sha}:{})})});
  if(!put.ok)throw new Error('上传失败，请稍后重试。');cloudSha=(await put.json()).content.sha;toast('加密快照已上传到私有仓库。');
}

document.addEventListener('click',async(event)=>{
  const button=event.target.closest('[data-action]');if(!button)return;
  const action=button.dataset.action,id=button.dataset.id;
  try {
    if(action==='close')closeModal();
    else if(action==='auth')authModal();
    else if(action==='lock')await lock();
    else if(action==='capture')captureModal();
    else if(action==='hot-filter'){hotFilter=button.dataset.platform;renderHotSection();}
    else if(action==='hot-expand'){const platform=button.dataset.platform;if(hotExpanded.has(platform))hotExpanded.delete(platform);else hotExpanded.add(platform);renderHotSection();}
    else if(action==='hot-refresh')await refreshHotboards();
    else if(action==='hot-save'){const board=normalizeHotboards(hotSnapshot).find(b=>b.id===button.dataset.platform);const item=board?.items.find(i=>i.rank===Number(button.dataset.rank));if(item&&hotboardState(board).code!=='unavailable')captureModal({title:item.title,source:item.url,sourcePlatform:board.name,sourceAuthor:item.author,type:'event',domain:DOMAINS[1],content:`来自${board.name} · ${board.label}第 ${item.rank} 名\n榜单快照时间：${new Date(board.updatedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}\n\n我想了解：\n- 发生了什么？\n- 各方的说法与证据是什么？\n- 还有什么信息需要核实？`});}
    else if(action==='share-import')shareImportModal(button.dataset.platform||'');
    else if(action==='event')captureModal({type:'event',domain:DOMAINS[1]});
    else if(action==='journal')journalModal(id);
    else if(action==='quick-journal')journalModal(null,true);
    else if(action==='think') { const e=data.entries.find(e=>e.date===dayKey()&&!e.opinion) || data.entries.find(e=>e.stage==='inbox');captureModal(e?{id:e.id,expand:true}:{expand:true}); }
    else if(action==='entry')entryModal(id);
    else if(action==='edit-entry')captureModal({id,expand:true});
    else if(action==='weekly')weeklyModal(id);
    else if(action==='recall')recallModal(id);
    else if(action==='recall-yes'||action==='recall-no'){if(!requireAccount())return;data.entries=data.entries.map(e=>e.id===id?reviewEntry(e,action==='recall-yes'):e);closeModal();await saveAndRender(action==='recall-yes'?'回想完成，理解又扎实了一点。':'没关系，明天再温习一次。');}
    else if(action==='filter'){filter=button.dataset.filter;render();}
    else if(action==='search'){location.hash='library';page='library';render();$('#library-search')?.focus();}
    else if(action==='library'||action==='settings'){page=action;location.hash=action;render();}
    else if(action==='focus-note')captureModal({domain:data.profile.focus});
    else if(action==='topic')captureModal({domain:data.profile.focus,title:button.dataset.topic});
    else if(action==='domain'){domainFilter=button.dataset.domain;location.hash='library';page='library';render();}
    else if(action==='news-save'){const item=news.items.find(n=>n.url===button.dataset.url);if(item)captureModal({title:item.title,source:item.url,sourcePlatform:item.source,type:item.category==='AI'?'knowledge':'event',domain:item.category==='AI'?DOMAINS[0]:DOMAINS[1]});}
    else if(action==='project')projectModal();
    else if(action==='project-toggle'){if(!requireAccount())return;data.projects=data.projects.map(p=>p.id===id?{...p,done:!p.done}:p);await saveAndRender('课题进度已更新。');}
    else if(action==='project-delete')confirmDelete('projects',id);
    else if(action==='journal-delete')confirmDelete('journals',id);
    else if(action==='entry-delete')confirmDelete('entries',id);
    else if(action==='delete-confirm'){
      if(!requireAccount())return;const kind=button.dataset.kind;if(!['projects','journals','entries'].includes(kind))return;
      const removed=data[kind].find(x=>x.id===id);data[kind]=data[kind].filter(x=>x.id!==id);
      const formName={projects:'project-form',journals:'journal-form',entries:'entry-form'}[kind];
      for(const [draftKey,draft] of Object.entries(data.drafts||{}))if(draft.recordId===id&&draft.kind==={projects:'project',journals:'journal',entries:'entry'}[kind])delete data.drafts[draftKey];
      if(await saveAndRender('记录已删除。')){closeModal();if(writerState)exitWriter();}
    }
    else if(action==='export-record')exportRecord(button.dataset.kind,id);
    else if(action==='export-current')exportCurrentForm();
    else if(action==='draft-open')openDraft(id);
    else if(action==='draft-delete')deleteDraftModal(id);
    else if(action==='draft-delete-confirm')await deleteDraft(id);
    else if(action==='draft-export')exportDraft(id);
    else if(action==='md-mode')setEditorMode(button);
    else if(action==='md-format')formatEditor(button);
    else if(action==='writer-preview')previewWriter();
    else if(action==='theme-toggle')window.RizhiTheme?.toggle();
    else if(action==='writer-save'){if(document.body.classList.contains('writer-previewing'))previewWriter();}
    else if(action==='export')await exportVault();
    else if(action==='markdown')exportMarkdown();
    else if(action==='import')importModal();
  }catch(e){toast(e.message || '操作未完成，请重试。');}
});
document.addEventListener('change',event=>{if(event.target.id==='domain-filter'){domainFilter=event.target.value;render();}});
document.addEventListener('input',event=>{
  if(event.target.matches('#share-import-form [name=shared]')){
    const form=event.target.form,link=extractSharedLink(event.target.value),status=$('#share-detected');
    status.textContent=link?`${link.platform?'已识别：'+link.platform:'已提取网页链接'} · ${link.url}`:'没有找到网页链接，请粘贴完整的分享文字或 http / https 链接';
    if(link?.platform)form.elements.platform.value=link.platform;
  }
  if(event.target.matches('#entry-form [name=source]')){
    const platform=detectPlatform(event.target.value);if(platform)event.target.form.elements.sourcePlatform.value=platform;
  }
  const form=event.target.closest('form');
  if(!form||form!==editableForm())return;
  if(event.target.matches('textarea'))updateEditor(event.target);
  editorDirty=true;clearTimeout(draftTimer);draftTimer=setTimeout(flushDraft,700);
  const note=$('.draft-status',form);if(note)note.textContent='正在自动保存草稿…';
  const status=$('#writer-status');if(status)status.innerHTML=icon('lock')+'正在加密保存…';
});
document.addEventListener('change',event=>{if(event.target.closest('form')===editableForm()&&editableForm()){editorDirty=true;clearTimeout(draftTimer);draftTimer=setTimeout(flushDraft,700);}});
document.addEventListener('input',event=>{if(event.target.id==='library-search'){query=event.target.value;const pos=event.target.selectionStart;render();$('#library-search').focus();$('#library-search').setSelectionRange(pos,pos);}});
document.addEventListener('submit',async(event)=>{
  event.preventDefault();const form=event.target,fd=new FormData(form),v=n=>String(fd.get(n)||'').trim(),error=$('.form-error',form),submit=event.submitter;
  if(submit)submit.disabled=true;if(error)error.textContent='';
  try {
    if(form.id==='share-import-form'){
      if(!requireAccount())return;const link=extractSharedLink(v('shared'));if(!link)throw new Error('没有找到有效的 http / https 网页链接，请检查分享内容。');if(!v('title'))throw new Error('写一个标题，方便以后找到这条发现。');
      captureModal({title:v('title'),source:link.url,sourcePlatform:v('platform')||link.platform,sourceAuthor:v('author'),content:v('summary'),type:'knowledge'});return;
    }else if(form.id==='auth-form') {
      const password=String(fd.get('password')||'');
      if(form.dataset.login==='true'){storedRaw=localStorage.getItem(VAULT_KEY);const result=await unseal(JSON.parse(storedRaw),password);data=migrateDrafts(result.data);key=result.key;salt=result.salt;}
      else {if(localStorage.getItem(VAULT_KEY))throw new Error('已有空间，请先登录或从备份恢复。');if(password.length<10)throw new Error('请至少设置 10 位密码。');if(password!==String(fd.get('confirm')))throw new Error('两次输入的密码不一致。');if(!v('name'))throw new Error('请写一个称呼。');const result=await createKey(password);key=result.key;salt=result.salt;data=freshData(v('name'));storedRaw=null;}
      preview=false;conflict=false;saveFailure=null;lastActivity=Date.now();await persist();closeModal();
      const requested=pendingWriterRoute||(location.hash.startsWith('#write/')?location.hash.slice(1):'');pendingWriterRoute='';
      if(requested)routeWriter(requested);else{page='today';location.hash='today';render();}toast('欢迎回到自己的节奏。');
    }else if(form.id==='import-form'||form.id==='cloud-restore-form') {
      let vault,sha;
      if(form.id==='import-form'){const file=fd.get('file');if(!file?.size)throw new Error('请选择备份文件。');if(file.size>28000000)throw new Error('文件过大，最多支持 20 MB 的记录。');vault=JSON.parse(await file.text());}else {vault=form._remote.vault;sha=form._remote.sha;}
      const result=await unseal(vault,String(fd.get('password')||''));await saveQueue.catch(()=>{});storedRaw=localStorage.getItem(VAULT_KEY);key=result.key;salt=result.salt;data=migrateDrafts(result.data);preview=false;conflict=false;await persist();if(sha)cloudSha=sha;closeModal();render();toast('已恢复你的积累。');
    }else {
      if(!requireAccount())return;
      const beforeSave=structuredClone(data);
      if(form.id==='journal-form') {
        if(!v('experience'))throw new Error('留下一句真实的经历吧。');const date=v('date');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>dayKey())throw new Error('记录日期应为今天或过去的一天。');
        const duplicate=data.journals.find(j=>j.date===date&&j.id!==form.dataset.id);if(duplicate)throw new Error('这一天已有手记，请先打开对应手记继续编辑。');
        const old=data.journals.find(j=>j.id===form.dataset.id),j={id:old?.id||uid(),date,mood:v('mood'),experience:v('experience'),thought:form.dataset.quick==='true'?old?.thought||'':v('thought'),takeaway:form.dataset.quick==='true'?old?.takeaway||'':v('takeaway')};data.journals=old?data.journals.map(x=>x.id===j.id?j:x):[...data.journals,j];
      }else if(form.id==='entry-form') {
        if(!v('title'))throw new Error('给这颗种子起个名字吧。');if(v('source')&&!safeUrl(v('source')))throw new Error('请填写 http 或 https 原文链接。');
        if(v('stage')==='understood'&&(!v('opinion')||!v('fact')||!v('boundary'))) { $('.thinking-fields',form).open=true;throw new Error('“能讲清”需要自己的解释、支持的证据，以及适用边界。先补充这三点，或选择“在思考”。'); }
        const old=data.entries.find(e=>e.id===form.dataset.id),e={id:old?.id||uid(),date:old?.date||dayKey(),title:v('title'),domain:v('domain'),type:v('type'),source:v('source'),sourcePlatform:v('sourcePlatform')||detectPlatform(v('source')),sourceAuthor:v('sourceAuthor'),content:v('content'),stage:v('stage'),tags:v('tags').split(/[,，]/).map(t=>t.trim()).filter(Boolean).slice(0,12),fact:v('fact'),opinion:v('opinion'),boundary:v('boundary'),rule:v('rule'),question:v('question'),reviewCount:old?.reviewCount||0,nextReview:old?.stage!=='inbox'&&old?.nextReview?old.nextReview:addDays(dayKey(),1)};
        data.entries=old?data.entries.map(x=>x.id===e.id?e:x):[...data.entries,e];
      }else if(form.id==='weekly-form') {
        if(!v('title')||!v('insight'))throw new Error('请写下问题和你目前的解释。');const old=data.reviews.find(r=>r.id===form.dataset.id),r={id:old?.id||uid(),date:old?.date||dayKey(),title:v('title'),before:v('before'),evidence:v('evidence'),insight:v('insight'),boundary:v('boundary'),next:v('next')};data.reviews=old?data.reviews.map(x=>x.id===r.id?r:x):[...data.reviews,r];
      }else if(form.id==='profile-form'){if(!v('name')||!v('focus'))throw new Error('称呼和主修方向不能为空。');data.profile={name:v('name'),focus:v('focus'),weeklyGoal:Number(v('weeklyGoal')),dailyMinutes:Number(v('dailyMinutes'))};}
      else if(form.id==='project-form'){if(!v('title'))throw new Error('请写一个课题名称。');data.projects.push({id:uid(),title:v('title'),description:v('description'),done:false});}
      else if(form.id==='cloud-form'){const status=$('#cloud-status');status.textContent='正在检查私有仓库与加密快照…';await cloudSync(form,submit?.value || 'push');if(status.isConnected)status.textContent='操作完成。';return;}
      else return;
      const savedDraftId=currentDraftKey,savedDraft=data.drafts?.[savedDraftId];
      clearTimeout(draftTimer);editorDirty=false;
      if(savedDraft)delete data.drafts[savedDraftId];
      if(await saveAndRender('已保存为正式记录，并从草稿箱移出。')){currentDraftKey='';const active=editableForm();if(active)active.dataset.draftId='';closeModal();}
      else {data=beforeSave;currentDraftKey=savedDraftId;editorDirty=true;captureDraft();}
    }
  }catch(e){if(error)error.textContent=e instanceof SyntaxError?'文件格式不正确，请选择日知加密备份。':e.message;else toast(e.message || '操作失败，请重试。');const status=$('#cloud-status');if(status)status.textContent=e.message;}
  finally {if(submit)submit.disabled=false;}
});
document.addEventListener('keydown',event=>{
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='s'&&editableForm()){event.preventDefault();editableForm().requestSubmit();return;}
  if((event.metaKey||event.ctrlKey)&&['b','i'].includes(event.key.toLowerCase())&&event.target.matches('.md-editor textarea')){event.preventDefault();const editor=event.target.closest('.md-editor');formatEditor($(`[data-format="${event.key.toLowerCase()==='b'?'bold':'italic'}"]`,editor));return;}
  if(event.key==='Escape'&&$('#modal-root .modal'))closeModal();
  if(event.key==='Tab'&&$('.modal')){const items=[...$('.modal').querySelectorAll('button:not([disabled]), a, input, textarea, select, summary')].filter(el=>el.getClientRects().length);const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
  if((event.metaKey||event.ctrlKey)&&event.key==='k'){event.preventDefault();if(!$('.modal')){$('[data-action="search"]')?.click();}}
});
document.addEventListener('invalid',event=>{
  if(event.target.closest('.writer-form')&&document.body.classList.contains('writer-previewing'))previewWriter();
},true);
['pointerdown','keydown','touchstart'].forEach(name=>document.addEventListener(name,()=>{lastActivity=Date.now();},{passive:true}));
setInterval(()=>{if(!preview&&Date.now()-lastActivity>15*60000)lock();},30000);
window.addEventListener('storage',event=>{if(event.key===VAULT_KEY&&!preview&&event.newValue!==storedRaw){conflict=true;toast('另一标签页更新了记录，请锁定后重新登录，避免覆盖。');}});
window.addEventListener('beforeunload',event=>{if(saveFailure||pendingSaves||editorDirty){flushDraft();event.preventDefault();event.returnValue='内容仍在保存，请稍等后离开。';}});
window.addEventListener('hashchange',()=>{
  const route=location.hash.slice(1)||'today';
  if(writerState?.route===route)return;
  if(writerState)removeWriter();
  if(route.startsWith('write/'))routeWriter(route);else{page=route;render();window.scrollTo({top:0});}
});
refreshHotboards(false);
const initialRoute=location.hash.slice(1)||'today';
if(initialRoute.startsWith('write/')){pendingWriterRoute=initialRoute;page='today';render();authModal();}else{page=initialRoute;render();}
fetch('./data/news.json').then(r=>r.ok?r.json():Promise.reject()).then(result=>{news=result;if(page==='world')render();}).catch(()=>{});
if(localStorage.getItem(VAULT_KEY)&&!$('#modal-root .modal'))authModal();
