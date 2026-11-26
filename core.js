export const DOMAINS = ['人工智能与计算机', '社会与公共事务', '经济与商业', '历史与文化', '科学与技术', '心理与生活'];
export const INTERVALS = [1, 3, 7, 14, 30, 90];
export function dayKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function addDays(day, count) { return new Date(Date.parse(`${day}T00:00:00Z`) + count * 86400000).toISOString().slice(0, 10); }
export function uid() { return crypto.randomUUID(); }
export function freshData(name = '同学') {
  return { version: 1, profile: { name, focus: DOMAINS[0], weeklyGoal: 4, dailyMinutes: 15 }, entries: [], journals: [], reviews: [], projects: [], drafts: {}, createdAt: new Date().toISOString() };
}
export function migrateDrafts(data) {
  const next = {};
  const kinds = {'journal-form':'journal','entry-form':'entry','weekly-form':'weekly','project-form':'project'};
  for (const [legacyKey, draft] of Object.entries(data.drafts || {})) {
    const [form, target, quick] = legacyKey.split(':');
    const id = draft.id && /^[A-Za-z0-9-]{1,80}$/.test(draft.id) ? draft.id : uid();
    const kind = draft.kind || kinds[form] || 'entry';
    const recordId = draft.recordId || (target && target !== 'new' && !/^\d{4}-\d{2}-\d{2}$/.test(target) ? target : '');
    next[id] = {...draft,id,kind,recordId,quick:draft.quick ?? quick === 'true',createdAt:draft.createdAt || draft.updatedAt || data.createdAt,updatedAt:draft.updatedAt || data.createdAt};
  }
  data.drafts = next; return data;
}
export function validateData(data) {
  if (!data || data.version !== 1 || !data.profile || typeof data.profile.name !== 'string' || typeof data.profile.focus !== 'string' || !Number.isInteger(data.profile.weeklyGoal) || data.profile.weeklyGoal < 1 || data.profile.weeklyGoal > 7 || !Array.isArray(data.entries) || !Array.isArray(data.journals) || !Array.isArray(data.reviews) || !Array.isArray(data.projects)) throw new Error('备份格式无效，未修改现有记录。');
  if (![2,5,10,15,20,30].includes(data.profile.dailyMinutes)) throw new Error('每日节奏格式无效。');
  const validId = value => typeof value === 'string' && /^[A-Za-z0-9-]{1,80}$/.test(value);
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
  const unique = new Set();
  for (const item of [...data.entries,...data.journals,...data.reviews,...data.projects]) {
    if (!item || !validId(item.id) || unique.has(item.id)) throw new Error('记录标识无效或重复。');
    unique.add(item.id);
  }
  for (const entry of data.entries) {
    if (!entry || typeof entry.id !== 'string' || typeof entry.title !== 'string' || typeof entry.content !== 'string' || typeof entry.domain !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || !['inbox', 'thinking', 'understood'].includes(entry.stage) || !Number.isInteger(entry.reviewCount) || entry.reviewCount < 0 || typeof entry.nextReview !== 'string' || !Array.isArray(entry.tags) || entry.tags.some(t => typeof t !== 'string')) throw new Error('知识卡片格式无效。');
    if (!validDate(entry.date) || !validDate(entry.nextReview)) throw new Error('卡片日期无效。');
    for (const field of ['fact','opinion','boundary','question','rule','source']) if (entry[field] !== undefined && typeof entry[field] !== 'string') throw new Error('卡片文本格式无效。');
  }
  for (const journal of data.journals) if (!journal || !validDate(journal.date) || typeof journal.experience !== 'string' || typeof journal.thought !== 'string' || typeof journal.takeaway !== 'string') throw new Error('日记格式无效。');
  for (const review of data.reviews) if (!review || !validDate(review.date) || typeof review.insight !== 'string') throw new Error('复盘格式无效。');
  for (const project of data.projects) if (!project || typeof project.id !== 'string' || typeof project.title !== 'string' || typeof project.done !== 'boolean') throw new Error('专题格式无效。');
  if (data.drafts !== undefined) {
    if (!data.drafts || typeof data.drafts !== 'object' || Array.isArray(data.drafts)) throw new Error('草稿格式无效。');
    for (const [id,draft] of Object.entries(data.drafts)) {
      if (!draft || !draft.fields || typeof draft.fields !== 'object' || Array.isArray(draft.fields) || Object.values(draft.fields).some(value=>typeof value!=='string')) throw new Error('草稿内容格式无效。');
      if (draft.id !== undefined && (!validId(draft.id) || draft.id !== id || !['journal','entry','weekly','project'].includes(draft.kind) || typeof draft.recordId !== 'string' || (draft.recordId && !validId(draft.recordId)) || typeof draft.quick !== 'boolean')) throw new Error('草稿信息格式无效。');
    }
  }
  return data;
}
export function activeDates(data) { return [...new Set([...data.journals.map(x => x.date), ...data.entries.map(x => x.date), ...data.reviews.map(x => x.date)])].sort(); }
export function stats(data, today = dayKey()) {
  const dates = activeDates(data).filter(d => d <= today);
  let streak = 0, cursor = dates.includes(today) ? today : addDays(today, -1);
  while (dates.includes(cursor)) { streak++; cursor = addDays(cursor, -1); }
  const weekDay = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
  const monday = addDays(today, -weekDay);
  return { days: dates.length, streak, cards: data.entries.length, understood: data.entries.filter(x => x.stage === 'understood').length, weekDays: dates.filter(d => d >= monday).length, due: data.entries.filter(x => x.stage !== 'inbox' && x.nextReview <= today).length, monday };
}
export function reviewEntry(entry, remembered, today = dayKey()) {
  const count = remembered ? Math.min(entry.reviewCount + 1, INTERVALS.length) : 0;
  return { ...entry, reviewCount: count, nextReview: addDays(today, INTERVALS[Math.max(0, count - 1)]), lastReviewed: today };
}
const enc = new TextEncoder();
function b64(bytes) { return btoa(String.fromCharCode(...bytes)); }
function unb64(str) { return Uint8Array.from(atob(str), c => c.charCodeAt(0)); }
async function keyFrom(password, salt) {
  const material = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function createKey(password) { const salt = crypto.getRandomValues(new Uint8Array(16)); return { key: await keyFrom(password, salt), salt: b64(salt) }; }
export async function seal(data, key, salt) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(data))));
  // Chunking avoids argument-count limits for larger personal archives.
  let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return { version: 1, salt, iv: b64(iv), ciphertext: btoa(binary), updatedAt: new Date().toISOString() };
}
export async function unseal(vault, password) {
  if (!vault || vault.version !== 1 || typeof vault.salt !== 'string' || typeof vault.iv !== 'string' || typeof vault.ciphertext !== 'string') throw new Error('不是有效的日知加密备份。');
  if (vault.ciphertext.length > 28000000) throw new Error('备份超过 20 MB，请分批整理后再导入。');
  const key = await keyFrom(password, unb64(vault.salt));
  let decrypted;
  try { decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(vault.iv) }, key, unb64(vault.ciphertext)); } catch { throw new Error('密码不正确，或备份文件已损坏。'); }
  return { data: validateData(JSON.parse(new TextDecoder().decode(decrypted))), key, salt: vault.salt };
}
