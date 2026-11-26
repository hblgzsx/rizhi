// Deliberately small Markdown renderer: raw HTML is always escaped.
// User-controlled text never becomes tag names, attributes, or executable URLs.
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
function safeHref(value) {
  try { const url = new URL(value); return ['https:','http:','mailto:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
export function inlineMarkdown(value) {
  const tokens = [];
  const token = html => { tokens.push(html); return `\u0000${tokens.length - 1}\u0000`; };
  // Strip placeholder bytes before tokenization, so input cannot forge tokens.
  let text = String(value).replace(/\u0000/g, '');
  text = text.replace(/`([^`\n]+)`/g, (_, code) => token(`<code>${escape(code)}</code>`));
  text = text.replace(/(!?)\[([^\]\n]+)\]\(([^\s)]+)(?:\s+"[^"\n]*")?\)/g, (_, image, label, url) => {
    const href = safeHref(url);
    if (!href) return token(escape(label));
    // Remote images are offered as links so private reading doesn't contact image hosts.
    return token(`<a href="${escape(href)}" target="_blank" rel="noopener noreferrer">${image ? '图片：' : ''}${escape(label)}</a>`);
  });
  text = escape(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  return text.replace(/\u0000(\d+)\u0000/g, (_, n) => tokens[Number(n)] || '');
}
export function renderMarkdown(input = '') {
  const lines = String(input).replace(/\r\n?/g, '\n').split('\n'), out = [];
  const cells = line => line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  const startsBlock = line => /^(#{1,6}\s|\s*```|\s*>|\s*[-*+]\s|\s*\d+[.)]\s|\s*(?:---+|\*\*\*+)\s*$)/.test(line);
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (/^\s*```/.test(line)) {
      const language = line.trim().slice(3).trim(), code = []; i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) code.push(lines[i++]);
      if (i < lines.length) i++;
      out.push(`<pre><code${/^[a-zA-Z0-9+-]{1,20}$/.test(language) ? ` class="language-${language}"` : ''}>${escape(code.join('\n'))}</code></pre>`); continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) { out.push(`<h${heading[1].length}>${inlineMarkdown(heading[2])}</h${heading[1].length}>`); i++; continue; }
    if (/^\s*(?:---+|\*\*\*+)\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
    if (/^\s*>/.test(line)) {
      const block=[];while(i<lines.length&&/^\s*>/.test(lines[i]))block.push(lines[i++].replace(/^\s*> ?/,''));
      out.push(`<blockquote>${renderMarkdown(block.join('\n'))}</blockquote>`);continue;
    }
    if (i+1<lines.length && line.includes('|') && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[i+1])) {
      const header=cells(line), rows=[];i+=2;
      while(i<lines.length&&lines[i].includes('|')&&lines[i].trim())rows.push(cells(lines[i++]));
      out.push(`<div class="md-table-wrap"><table><thead><tr>${header.map(c=>`<th>${inlineMarkdown(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${header.map((_,n)=>`<td>${inlineMarkdown(row[n] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);continue;
    }
    const listMatch=line.match(/^\s*(?:([-*+])|(\d+)[.)])\s+(.+)$/);
    if(listMatch) {
      const ordered=!!listMatch[2],items=[];
      while(i<lines.length) {
        const match=lines[i].match(/^\s*(?:([-*+])|(\d+)[.)])\s+(.+)$/);
        if(!match||!!match[2]!==ordered)break;
        let content=match[3];const task=content.match(/^\[([ xX])\]\s*(.*)$/);
        if(task)content=`<span class="md-checkbox" aria-label="${task[1]===' '?'未完成':'已完成'}">${task[1]===' '?'☐':'☑'}</span> ${inlineMarkdown(task[2])}`;
        else content=inlineMarkdown(content);
        items.push(`<li>${content}</li>`);i++;
      }
      const tag=ordered?'ol':'ul';out.push(`<${tag}>${items.join('')}</${tag}>`);continue;
    }
    const paragraph=[line];i++;
    while(i<lines.length&&lines[i].trim()&&!startsBlock(lines[i])&&!(i+1<lines.length&&lines[i].includes('|')&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1])))paragraph.push(lines[i++]);
    out.push(`<p>${paragraph.map(inlineMarkdown).join('<br>')}</p>`);
  }
  return out.join('\n');
}
