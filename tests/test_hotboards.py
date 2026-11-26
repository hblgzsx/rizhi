import importlib.util
import pathlib
import unittest
from datetime import datetime, timezone, timedelta

spec = importlib.util.spec_from_file_location('fetch_hotboards', pathlib.Path(__file__).resolve().parents[1] / 'scripts' / 'fetch_hotboards.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class RankingsTests(unittest.TestCase):
    def test_source_nanoseconds_parse_on_python39(self):
        timestamp = module.parse_time('2026-11-26T17:50:30.629978853+08:00')
        self.assertIsNotNone(timestamp)
        self.assertEqual(timestamp.isoformat(), '2026-11-26T09:50:30.629978+00:00')

    def test_direct_platform_adapters(self):
        fixtures = {
            'douyin': {'data': {'word_list': [{'word': '测试热点', 'hot_value': 120000}] }},
            'weibo': {'data': {'realtime': [{'word': '广告', 'is_ad': 1}, {'word': '正常话题', 'num': 1234}]}},
            'bilibili': {'code': 0, 'data': {'list': [{'title': '测试视频', 'bvid': 'BV123abc', 'stat': {'view': 10000}, 'owner': {'name': '测试作者'}}]}},
            'zhihu': {'data': [{'target': {'title': '一个问题', 'id': 123, 'url': 'https://api.zhihu.com/questions/123'}, 'detail_text': '123 万热度'}]},
            'toutiao': {'data': [{'Title': '测试话题', 'ClusterIdStr': '1234567890123456789', 'HotValue': '20000'}]},
        }
        for platform, payload in fixtures.items():
            with self.subTest(platform=platform):
                items = module.parse_direct(platform, payload)
                self.assertEqual(len(items), 1)
                self.assertEqual(items[0]['rank'], 1)
                self.assertTrue(items[0]['url'].startswith('https://'))
        self.assertEqual(module.parse_direct('bilibili', fixtures['bilibili'])[0]['metric'], '1.0万 播放')
        self.assertEqual(module.parse_direct('zhihu', fixtures['zhihu'])[0]['metric'], '123 万热度')
        self.assertIn('1234567890123456789', module.parse_direct('toutiao', fixtures['toutiao'])[0]['url'])

    def test_empty_or_error_never_creates_fake_rankings(self):
        for platform in ['douyin', 'weibo', 'bilibili', 'zhihu', 'toutiao']:
            with self.subTest(platform=platform):
                with self.assertRaises(ValueError):
                    module.parse_direct(platform, {'code': -1, 'data': []} if platform in ['zhihu', 'toutiao'] else {'code': -1})

    def test_normalize_filters_unsafe_links_and_preserves_rank(self):
        result = module.normalize_items([
            {'rank': 3, 'title': '三', 'url': 'https://weibo.com/a'},
            {'rank': 1, 'title': '伪造', 'url': 'https://weibo.com.evil.test/a'},
            {'rank': 2, 'title': '二', 'url': 'javascript:alert(1)'},
            {'rank': 4, 'title': '重复', 'url': 'https://weibo.com/a'},
            {'rank': 5, 'title': '账号密码', 'url': 'https://user:password@weibo.com/a'},
        ], ['weibo.com'])
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['rank'], 3)

    def test_previous_snapshot_retains_original_time_on_failure(self):
        cfg = module.CONFIG[0]
        old = {'updatedAt': '2026-11-20T00:00:00+00:00', 'items': [{'rank': 1, 'title': '过去的标题', 'url': 'https://www.douyin.com/search/test'}], 'provider': '平台公开榜单'}
        result = module.board_from_previous(cfg, old, module.now_iso())
        self.assertEqual(result['updatedAt'], old['updatedAt'])
        self.assertEqual(result['status'], 'stale')
        self.assertEqual(result['items'][0]['title'], '过去的标题')
        self.assertEqual(module.board_from_previous(cfg, {}, module.now_iso())['status'], 'unavailable')

    def test_aggregate_checks_source_time_and_failure_state(self):
        cfg = module.CONFIG[3]
        now = datetime.now(timezone.utc)
        board = module.board_from_previous(cfg, {}, now.isoformat())
        raw = {'platform': 'xiaohongshu', 'ok': False, 'fetched_at': now.isoformat(), 'items': [{'rank': 1, 'title': '话题', 'url': 'https://www.xiaohongshu.com/search_result?keyword=test', 'hot_text': '12w'}]}
        self.assertFalse(module.apply_aggregate(board, cfg, {'boards': [raw]}))
        raw['ok'] = True
        self.assertTrue(module.apply_aggregate(board, cfg, {'boards': [raw]}))
        self.assertEqual(board['status'], 'ready')
        self.assertEqual(board['items'][0]['metric'], '12w')
        self.assertIn('solarhell', board['provider'])
        raw['fetched_at'] = (now + timedelta(days=1)).isoformat()
        self.assertFalse(module.apply_aggregate(board, cfg, {'boards': [raw]}))
        old_board = module.board_from_previous(cfg, {}, now.isoformat())
        raw['fetched_at'] = (now - timedelta(days=1)).isoformat()
        self.assertTrue(module.apply_aggregate(old_board, cfg, {'boards': [raw]}))
        self.assertEqual(old_board['status'], 'stale')
        self.assertFalse(module.apply_aggregate(board, cfg, {'boards': [raw]}))

if __name__ == '__main__':
    unittest.main()
