"""Public ranking snapshots: no login cookies, private credentials, or bypasses."""
import json
import os
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
from urllib.parse import quote, urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = os.path.join(ROOT, 'data', 'hotboards.json')
PUBLISHED = 'https://hblgzsx.github.io/rizhi/data/hotboards.json'
AGGREGATE = 'https://solarhell.github.io/hot-search-crawler/latest.json'
PROVIDER = 'https://github.com/solarhell/hot-search-crawler'
CONFIG = [
    ('douyin', '抖音', '热点榜', 'https://www.douyin.com/', 'https://www.douyin.com/aweme/v1/web/hot/search/list/?device_platform=webapp&aid=6383&channel=channel_pc_web&detail_list=1', ['douyin.com']),
    ('weibo', '微博', '热搜榜', 'https://s.weibo.com/top/summary/', 'https://weibo.com/ajax/side/hotSearch', ['weibo.com', 'weibo.cn']),
    ('bilibili', 'B 站', '全站排行榜', 'https://www.bilibili.com/v/popular/rank/all', 'https://api.bilibili.com/x/web-interface/ranking/v2?rid=0&type=all', ['bilibili.com', 'b23.tv']),
    ('xiaohongshu', '小红书', '热点榜', 'https://www.xiaohongshu.com/', None, ['xiaohongshu.com', 'xhslink.com']),
    ('zhihu', '知乎', '热榜', 'https://www.zhihu.com/hot', 'https://api.zhihu.com/topstory/hot-lists/total?limit=30', ['zhihu.com']),
    ('toutiao', '今日头条', '热榜', 'https://www.toutiao.com/', 'https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc', ['toutiao.com']),
]

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def parse_time(value):
    try:
        # Go-based public snapshots use nanoseconds; Python 3.9 accepts at most
        # microseconds. Preserve the real time while trimming excess precision.
        timestamp = re.sub(r'(\.\d{6})\d+', r'\1', str(value).replace('Z', '+00:00'))
        result = datetime.fromisoformat(timestamp)
        return result.astimezone(timezone.utc) if result.tzinfo else None
    except (ValueError, TypeError):
        return None

def request_json(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (compatible; Rizhi/1.0; public learning headlines)', 'Accept': 'application/json', 'Referer': 'https://www.bilibili.com/' if 'bilibili.com' in url else url.split('/')[0] + '//' + url.split('/')[2] + '/'})
    with urllib.request.urlopen(req, timeout=18) as response:
        raw = response.read(4_000_001)
    if len(raw) > 4_000_000:
        raise ValueError('Response exceeded size limit')
    return json.loads(raw)

def safe_url(value, hosts):
    if not isinstance(value, str):
        return ''
    try:
        parsed = urlparse(value)
        host = (parsed.hostname or '').lower()
        if parsed.scheme not in ('http', 'https') or parsed.username or parsed.password:
            return ''
        return value if any(host == domain or host.endswith('.' + domain) for domain in hosts) else ''
    except ValueError:
        return ''

def text(value, limit=240):
    return ' '.join(str(value or '').split())[:limit]

def metric(value, suffix='热度'):
    try:
        num = float(value)
        if num < 0 or num != num or num == float('inf'):
            return ''
        if num >= 100_000_000:
            return f'{num / 100_000_000:.1f}亿 {suffix}'
        if num >= 10_000:
            return f'{num / 10_000:.1f}万 {suffix}'
        return f'{int(num)} {suffix}'
    except (ValueError, TypeError):
        return ''

def normalize_items(items, hosts):
    output, seen = [], set()
    if not isinstance(items, list):
        return output
    for index, raw in enumerate(items):
        if not isinstance(raw, dict):
            continue
        title, url = text(raw.get('title')), safe_url(raw.get('url'), hosts)
        rank = raw.get('rank', index + 1)
        if not title or not url or url in seen or not isinstance(rank, int) or isinstance(rank, bool) or not 1 <= rank <= 1000:
            continue
        seen.add(url)
        output.append({'rank': rank, 'title': title, 'url': url, 'metric': text(raw.get('metric'), 70), 'author': text(raw.get('author'), 80)})
    return sorted(output, key=lambda row: row['rank'])[:15]

def parse_direct(platform, payload):
    if not isinstance(payload, dict):
        raise ValueError('Invalid ranking response')
    output = []
    if platform == 'douyin':
        rows = payload.get('data', {}).get('word_list', [])
        for i, row in enumerate(rows):
            title = text(row.get('word'))
            output.append({'rank': i + 1, 'title': title, 'url': 'https://www.douyin.com/search/' + quote(title, safe=''), 'metric': metric(row.get('hot_value'))})
    elif platform == 'weibo':
        rows = payload.get('data', {}).get('realtime', [])
        for row in rows:
            if row.get('is_ad'):
                continue
            title = text(row.get('word') or row.get('word_scheme'))
            output.append({'rank': len(output) + 1, 'title': title, 'url': 'https://s.weibo.com/weibo?q=' + quote(title, safe=''), 'metric': metric(row.get('num') or row.get('raw_hot'))})
    elif platform == 'bilibili':
        if payload.get('code') != 0:
            raise ValueError('Platform ranking unavailable')
        for i, row in enumerate(payload.get('data', {}).get('list', [])):
            bvid = str(row.get('bvid', ''))
            if not re.fullmatch(r'BV[A-Za-z0-9]+', bvid):
                continue
            output.append({'rank': i + 1, 'title': row.get('title'), 'url': 'https://www.bilibili.com/video/' + bvid, 'metric': metric(row.get('stat', {}).get('view'), '播放'), 'author': row.get('owner', {}).get('name', '')})
    elif platform == 'zhihu':
        for i, row in enumerate(payload.get('data', [])):
            target = row.get('target', {})
            question = str(target.get('url', '')).rstrip('/').split('/')[-1]
            if not question.isdigit():
                continue
            output.append({'rank': i + 1, 'title': target.get('title'), 'url': 'https://www.zhihu.com/question/' + question, 'metric': text(row.get('detail_text'))})
    elif platform == 'toutiao':
        for i, row in enumerate(payload.get('data', [])):
            cluster = str(row.get('ClusterIdStr') or row.get('ClusterId') or '')
            if not cluster.isdigit():
                continue
            output.append({'rank': i + 1, 'title': row.get('Title'), 'url': 'https://www.toutiao.com/trending/' + cluster + '/', 'metric': metric(row.get('HotValue'))})
    else:
        raise ValueError('Unsupported platform')
    hosts = next(cfg[5] for cfg in CONFIG if cfg[0] == platform)
    output = normalize_items(output, hosts)
    if not output:
        raise ValueError('No usable ranking items')
    return output

def board_from_previous(cfg, previous, checked_at):
    platform, name, label, url, endpoint, hosts = cfg
    board = {'id': platform, 'name': name, 'label': label, 'url': url, 'checkedAt': checked_at, 'updatedAt': None, 'status': 'unavailable', 'items': [], 'provider': '', 'providerUrl': '', 'message': '本次未取得有效榜单，可前往平台查看。'}
    previous_time = parse_time(previous.get('updatedAt'))
    if previous_time and previous_time <= datetime.now(timezone.utc) + timedelta(minutes=10):
        items = normalize_items(previous.get('items', []), hosts)
        if items:
            board.update(items=items, updatedAt=previous['updatedAt'], status='stale', provider=text(previous.get('provider'), 80), providerUrl=safe_url(previous.get('providerUrl'), hosts + ['github.com', 'solarhell.github.io']), message='本次更新未成功，保留上次快照。')
    return board

def fetch_direct(cfg):
    platform, _, _, _, endpoint, _ = cfg
    if not endpoint:
        return None
    items = parse_direct(platform, request_json(endpoint))
    return {'items': items, 'updatedAt': now_iso(), 'status': 'ready', 'provider': '平台公开榜单', 'providerUrl': endpoint, 'message': ''}

def apply_aggregate(board, cfg, payload):
    rows = payload.get('boards', []) if isinstance(payload, dict) else []
    raw = next((item for item in rows if isinstance(item, dict) and item.get('platform') == cfg[0]), None)
    if not raw or raw.get('ok') is not True:
        return False
    updated = parse_time(raw.get('fetched_at'))
    now = datetime.now(timezone.utc)
    if not updated or updated > now + timedelta(minutes=10):
        return False
    normalized = normalize_items([dict(item, metric=item.get('hot_text') or metric(item.get('hot'))) for item in raw.get('items', []) if isinstance(item, dict)], cfg[5])
    if not normalized:
        return False
    # Never replace a newer local snapshot with an older third-party snapshot.
    old_time = parse_time(board.get('updatedAt'))
    if old_time and old_time > updated:
        return False
    stale = now - updated > timedelta(hours=3)
    board.update(items=normalized, updatedAt=updated.isoformat(), status='stale' if stale else 'ready', provider='公开聚合快照 · solarhell', providerUrl=PROVIDER, message='来源快照较旧，请留意更新时间。' if stale else '')
    return True

def load_previous():
    candidates = []
    try:
        with open(TARGET, encoding='utf-8') as file:
            candidates.append(json.load(file))
    except (OSError, ValueError):
        pass
    # The prior deployed artifact survives scheduled builds without committing data.
    if os.environ.get('GITHUB_ACTIONS') == 'true':
        try:
            candidates.append(request_json(PUBLISHED))
        except Exception:
            pass
    result = {}
    for payload in candidates:
        if not isinstance(payload, dict) or payload.get('version') != 1:
            continue
        for board in payload.get('boards', []):
            if not isinstance(board, dict):
                continue
            key = board.get('id')
            old = result.get(key, {})
            if key not in result or (parse_time(board.get('updatedAt')) or datetime.min.replace(tzinfo=timezone.utc)) > (parse_time(old.get('updatedAt')) or datetime.min.replace(tzinfo=timezone.utc)):
                result[key] = board
    return result

def main():
    checked_at = now_iso()
    previous = load_previous()
    boards = {cfg[0]: board_from_previous(cfg, previous.get(cfg[0], {}), checked_at) for cfg in CONFIG}
    with ThreadPoolExecutor(max_workers=5) as executor:
        jobs = {executor.submit(fetch_direct, cfg): cfg for cfg in CONFIG if cfg[4]}
        for future in as_completed(jobs):
            cfg = jobs[future]
            try:
                boards[cfg[0]].update(future.result())
            except Exception as error:
                print(cfg[0] + ': direct source unavailable (' + type(error).__name__ + ')')
    if any(boards[key]['status'] != 'ready' for key in ['weibo', 'douyin', 'xiaohongshu']):
        try:
            aggregate = request_json(AGGREGATE)
            for cfg in CONFIG:
                if cfg[0] in ['weibo', 'douyin', 'xiaohongshu'] and boards[cfg[0]]['status'] != 'ready':
                    apply_aggregate(boards[cfg[0]], cfg, aggregate)
        except Exception as error:
            print('Aggregate unavailable (' + type(error).__name__ + ')')
    result = {'version': 1, 'generatedAt': checked_at, 'boards': list(boards.values())}
    os.makedirs(os.path.dirname(TARGET), exist_ok=True)
    temporary = TARGET + '.tmp'
    with open(temporary, 'w', encoding='utf-8') as file:
        json.dump(result, file, ensure_ascii=False, indent=2)
    os.replace(temporary, TARGET)
    print(json.dumps({b['id']: {'status': b['status'], 'items': len(b['items'])} for b in result['boards']}))

if __name__ == '__main__':
    main()
