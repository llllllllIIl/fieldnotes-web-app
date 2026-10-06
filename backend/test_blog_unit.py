"""Ranking + payload shape tests. No network. Run: python -m unittest test_blog_unit"""
import unittest
from datetime import datetime, timedelta, timezone

from app import hot_score, rank_comments
from auth import first_row


class FirstRowTest(unittest.TestCase):
    def test_list_shape(self):
        self.assertEqual(first_row([{"id": 1}]), {"id": 1})

    def test_empty_list(self):
        self.assertIsNone(first_row([]))

    def test_none(self):
        self.assertIsNone(first_row(None))

    def test_dict_passthrough(self):
        self.assertEqual(first_row({"id": 2}), {"id": 2})


class HotScoreTest(unittest.TestCase):
    def test_fire_counts_five(self):
        now = datetime.now(timezone.utc).isoformat()
        self.assertGreater(hot_score(0, 1, now), hot_score(4, 0, now))
        self.assertGreater(hot_score(6, 0, now), hot_score(0, 1, now))

    def test_fresh_beats_stale(self):
        fresh = datetime.now(timezone.utc).isoformat()
        stale = (datetime.now(timezone.utc) - timedelta(hours=72)).isoformat()
        self.assertGreater(hot_score(5, 0, fresh), hot_score(5, 0, stale))


class RankCommentsTest(unittest.TestCase):
    def _c(self, cid, likes, fires, age_h, pinned=False):
        return {
            "id": cid,
            "like_count": likes,
            "fire_count": fires,
            "created_at": (
                datetime.now(timezone.utc) - timedelta(hours=age_h)
            ).isoformat(),
            "pinned": pinned,
        }

    def test_pinned_first_despite_score(self):
        hot = self._c("hot", 100, 50, 1)
        pin = self._c("pin", 0, 0, 100, pinned=True)
        out = rank_comments([hot, pin])
        self.assertEqual([c["id"] for c in out], ["pin", "hot"])

    def test_more_reactions_first(self):
        out = rank_comments([self._c("a", 1, 0, 1), self._c("b", 10, 0, 1)])
        self.assertEqual([c["id"] for c in out], ["b", "a"])

    def test_fresh_wins_tie(self):
        out = rank_comments([self._c("old", 5, 0, 72), self._c("new", 5, 0, 1)])
        self.assertEqual([c["id"] for c in out], ["new", "old"])


if __name__ == "__main__":
    unittest.main()
