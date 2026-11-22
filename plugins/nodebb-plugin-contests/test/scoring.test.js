'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { rubricScore, toPoints, scoreContest } = require('../lib/scoring');

// A sheet where every criterion gets the same mark: the rubric score is exactly mark x 10.
const flat = mark => ({ readability: mark, hierarchy: mark, accuracy: mark, creativity: mark });
const sheet = (entryId, mark, judgeUid = 1) => ({ judgeUid, entryId, scores: flat(mark) });
const votesFor = (entryId, count, from) => Array.from({ length: count }, (_, i) => ({ voterUid: from + i, voterTier: 2, entryId }));
const byId = (results, id) => results.find(r => r.id === id);

test('rubric: weighted average on a 0-100 scale', () => {
	assert.equal(rubricScore(flat(10)), 100);
	assert.equal(Math.round(rubricScore({ readability: 9, hierarchy: 8, accuracy: 9, creativity: 7 }) * 100) / 100, 83.5);
	assert.equal(rubricScore({ readability: 99 }), 30); // clamped to max; missing criteria count as 0
});

test('points: best entry 100, weakest 0; no spread means no advantage', () => {
	assert.deepEqual(toPoints([60, 75, 90]), [0, 50, 100]);
	assert.deepEqual(toPoints([80, 80]), [100, 100]);
	assert.deepEqual(toPoints([0, 0, 0]), [0, 0, 0]);
});

test('judges outweigh the public: head to head, the judges\' pick wins 70 to 30', () => {
	const entries = [{ id: 'A', uid: 101 }, { id: 'B', uid: 102 }];
	const { results } = scoreContest({
		entries,
		sheets: [sheet('A', 8.2), sheet('B', 7.6)],
		votes: [...votesFor('A', 10, 1000), ...votesFor('B', 25, 2000)],
	});
	assert.deepEqual(results.map(r => [r.id, r.final]), [['A', 70], ['B', 30]]);
});

test('the public decides a close call between the judges', () => {
	const entries = [{ id: 'A', uid: 101 }, { id: 'B', uid: 102 }, { id: 'C', uid: 103 }];
	const { results } = scoreContest({
		entries,
		sheets: [sheet('A', 8.5), sheet('B', 8.4), sheet('C', 6)], // averages 85, 84, 60
		votes: [...votesFor('A', 5, 1000), ...votesFor('B', 30, 2000)],
	});
	// judge points A 100, B 96, C 0; public points A 16.67, B 100, C 0
	assert.equal(results[0].id, 'B');
	assert.deepEqual(byId(results, 'B'), {
		id: 'B', uid: 102, rank: 1, final: 97.2,
		judge: { average: 84, points: 96, sheets: 1 }, public: { votes: 30, points: 100 },
	});
	assert.equal(byId(results, 'A').final, 75);
});

test('a clear judge lead survives a strong public preference', () => {
	const entries = [{ id: 'A', uid: 101 }, { id: 'B', uid: 102 }, { id: 'C', uid: 103 }];
	const { results } = scoreContest({
		entries,
		sheets: [sheet('A', 9), sheet('B', 6), sheet('C', 7)],
		votes: [...votesFor('A', 10, 1000), ...votesFor('B', 40, 2000)],
	});
	assert.deepEqual(results.map(r => [r.id, r.final]), [['A', 77.5], ['B', 30], ['C', 23.33]]);
});

test('vote rules: tier, self, judges, duplicates, per-voter limit', () => {
	const entries = [{ id: 'A', uid: 101 }, { id: 'B', uid: 102 }];
	const sheets = [sheet('A', 8), sheet('B', 7)];
	const votes = [
		{ voterUid: 500, voterTier: 1, entryId: 'A' }, // tier too low
		{ voterUid: 101, voterTier: 3, entryId: 'A' }, // own entry
		{ voterUid: 1, voterTier: 5, entryId: 'B' }, // judge
		{ voterUid: 600, voterTier: 2, entryId: 'A', timestamp: 1 },
		{ voterUid: 600, voterTier: 2, entryId: 'A', timestamp: 2 }, // duplicate
		{ voterUid: 700, voterTier: 2, entryId: 'Z' }, // no such entry
	];
	const { votes: summary, results } = scoreContest({ entries, sheets, votes });
	assert.equal(summary.counted, 1);
	assert.deepEqual(summary.rejected, { tier: 1, self: 1, judge: 1, duplicate: 1, limit: 0, 'unknown-entry': 1 });
	assert.equal(byId(results, 'A').public.votes, 1);

	const four = [...entries, { id: 'C', uid: 103 }, { id: 'D', uid: 104 }];
	const many = ['A', 'B', 'C', 'D'].map((entryId, i) => ({ voterUid: 900, voterTier: 2, entryId, timestamp: i }));
	const limited = scoreContest({ entries: four, sheets, votes: many });
	assert.equal(limited.votes.counted, 3); // the earliest three count
	assert.equal(limited.votes.rejected.limit, 1);
	assert.equal(byId(limited.results, 'D').public.votes, 0);
});

test('no public votes: the judges alone decide, with a warning', () => {
	const entries = [{ id: 'A', uid: 101 }, { id: 'B', uid: 102 }];
	const { results, warnings } = scoreContest({ entries, sheets: [sheet('A', 8), sheet('B', 9)] });
	assert.deepEqual(results.map(r => [r.id, r.final]), [['B', 70], ['A', 0]]);
	assert.ok(warnings.some(w => w.includes('no eligible public votes')));
});

test('ties: equal scores are broken by earlier submission', () => {
	const entries = [{ id: 'X', uid: 1, submittedAt: 5 }, { id: 'Y', uid: 2, submittedAt: 3 }];
	const { results } = scoreContest({ entries, sheets: [sheet('X', 8, 9), sheet('Y', 8, 9)], judges: [9] });
	assert.deepEqual(results.map(r => [r.id, r.rank]), [['Y', 1], ['X', 2]]);
});

test('disqualified entries are left out; missing judge sheets produce warnings', () => {
	const entries = [{ id: 'A', uid: 101 }, { id: 'B', uid: 102 }, { id: 'C', uid: 103, disqualified: true }];
	const sheets = [sheet('A', 8, 1), sheet('A', 9, 2), sheet('B', 7, 1)];
	const { results, warnings } = scoreContest({ entries, sheets, judges: [1, 2] });
	assert.equal(results.length, 2);
	assert.equal(byId(results, 'A').judge.average, 85);
	assert.equal(byId(results, 'B').judge.sheets, 1);
	assert.ok(warnings.some(w => w.includes('entry B') && w.includes('2')));
});
