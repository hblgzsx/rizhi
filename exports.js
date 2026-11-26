export function timestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23' }).formatToParts(date);
  const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}_${p.hour}-${p.minute}-${p.second}-${String(date.getMilliseconds()).padStart(3,'0')}`;
}
export function safeFilename(value, max = 65) {
  const name=String(value||'未命名').normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g,'-').replace(/\s+/g,' ').replace(/-+/g,'-').replace(/^[.\s]+|[.\s]+$/g,'');
  const clipped=Array.from(name || '未命名').slice(0,max).join('').replace(/[.\s]+$/g,'');
  return /^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(?:\.|$)/i.test(clipped) ? `_${clipped}` : clipped;
}
export function exportFilename({date,kind,title,extension='md',now=new Date()}) {
  return `${date || timestamp(now).slice(0,10)}_${safeFilename(kind,15)}_${safeFilename(title,55)}_导出-${timestamp(now)}.${extension}`;
}
const section=(title,body)=>body?`## ${title}\n\n${body}\n\n`:'';
export function recordMarkdown(kind,record,{name='我',now=new Date()}={}) {
  const label={journals:'生活手记',entries:record.type==='event'?'事件观察':'知识笔记',reviews:'每周复盘'}[kind];
  const title=kind==='journals'?`${record.date} · 生活手记`:record.title || '这一周的新理解';
  let content=`# ${title}\n\n记录日期：${record.date}  \n类型：${label}  \n作者：${name}  \n导出时间：${timestamp(now)}（北京时间）\n\n`;
  if(kind==='journals') content+=`心情：${record.mood||'未记录'}\n\n`+section('今天经历了什么',record.experience)+section('我的感受与想法',record.thought)+section('今天带走的一句话',record.takeaway);
  if(kind==='entries') content+=`所属领域：${record.domain}  \n消化阶段：${{inbox:'待消化',thinking:'在思考',understood:'能讲清'}[record.stage]||'未分类'}  \n标签：${(record.tags||[]).join('、')}\n\n`+section('原文链接',record.source)+section('收集的信息',record.content)+section('事实与证据',record.fact)+section('我目前的解释',record.opinion)+section('适用边界与反例',record.boundary)+section('规律与连接',record.rule)+section('继续追问',record.question);
  if(kind==='reviews') content+=section('原来的想法',record.before)+section('新的证据',record.evidence)+section('现在的解释',record.insight)+section('边界与反例',record.boundary)+section('下周的小问题',record.next);
  return content.trimEnd()+'\n';
}
export function allMarkdown(data,now=new Date()) {
  const ordered=kind=>data[kind].slice().sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)).map(r=>recordMarkdown(kind,r,{name:data.profile.name,now}));
  return `# ${data.profile.name}的日知 · 全量存档\n\n导出时间：${timestamp(now)}（北京时间）  \n长期主修：${data.profile.focus}\n\n此文件为可读明文，仅供私人保存。包含 ${data.journals.length} 篇手记、${data.entries.length} 张知识卡片、${data.reviews.length} 篇复盘及 ${data.projects.length} 个实践课题。\n\n---\n\n`+[...ordered('journals'),...ordered('entries'),...ordered('reviews'),`# 实践课题\n\n${data.projects.map(p=>`- [${p.done?'x':' '}] ${p.title}\n${p.description?'\n'+p.description+'\n':''}`).join('\n')}`].join('\n---\n\n')+'\n';
}
