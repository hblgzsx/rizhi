"""Fetch source headlines only; preserve original dates and URLs. No API keys required."""
import json
import os
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

FEEDS = [
    ('中国新闻网', 'https://www.chinanews.com.cn/rss/scroll-news.xml', '社会'),
    ('arXiv · cs.AI', 'https://rss.arxiv.org/rss/cs.AI', 'AI'),
    ('Hacker News', 'https://news.ycombinator.com/rss', 'AI'),
]
TARGET = os.path.join(os.path.dirname(__file__), '..', 'data', 'news.json')

def local_name(tag):
    return tag.split('}')[-1]

def child_text(element, tag):
    for child in element:
        if local_name(child.tag) == tag:
            return ''.join(child.itertext()).strip()
    return ''

def fetch_feed(feed):
    name, url, category = feed
    request = urllib.request.Request(url, headers={'User-Agent': 'Rizhi/1.0 personal learning RSS reader'})
    with urllib.request.urlopen(request, timeout=22) as response:
        raw = response.read(3_000_001)
    if len(raw) > 3_000_000:
        raise ValueError('Feed exceeded size limit')
    root = ET.fromstring(raw)
    items = []
    for entry in root.iter():
        if local_name(entry.tag) != 'item':
            continue
        title = ' '.join(child_text(entry, 'title').split())
        link = child_text(entry, 'link')
        date = child_text(entry, 'pubDate') or child_text(entry, 'date')
        if not title or not link.startswith(('http://', 'https://')):
            continue
        try:
            published = parsedate_to_datetime(date).astimezone(timezone.utc).isoformat()
        except (TypeError, ValueError):
            try:
                published = datetime.fromisoformat(date.replace('Z', '+00:00')).isoformat()
            except (ValueError, TypeError):
                published = None
        items.append({'title': title[:300], 'url': link, 'published': published, 'source': name, 'category': category})
        if len(items) >= 6:
            break
    if not items:
        raise ValueError('Feed returned no usable headlines')
    return items

def main():
    old = {'items': []}
    try:
        with open(TARGET, encoding='utf-8') as file:
            old = json.load(file)
    except (OSError, ValueError):
        pass
    items, errors, good_sources = [], [], set()
    with ThreadPoolExecutor(max_workers=3) as executor:
        jobs = {executor.submit(fetch_feed, feed): feed[0] for feed in FEEDS}
        for future in as_completed(jobs):
            name = jobs[future]
            try:
                items.extend(future.result())
                good_sources.add(name)
            except Exception as error:
                errors.append({'source': name, 'reason': str(error)[:200]})
                print(name + ': unavailable (' + type(error).__name__ + ')')
    # Keep previous items when an upstream fails, without rewriting their dates.
    items.extend(item for item in old.get('items', []) if item.get('source') not in good_sources)
    items.sort(key=lambda item: item.get('published') or '', reverse=True)
    result = {'generatedAt': datetime.now(timezone.utc).isoformat(), 'items': items[:30], 'errors': errors}
    os.makedirs(os.path.dirname(TARGET), exist_ok=True)
    with open(TARGET, 'w', encoding='utf-8') as file:
        json.dump(result, file, ensure_ascii=False, indent=2)
    print('Saved %d headlines; %d sources unavailable' % (len(items), len(errors)))

if __name__ == '__main__':
    main()
