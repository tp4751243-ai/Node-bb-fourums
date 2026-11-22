'use strict';

/**
 * Contest scoring for בית העורכים: 70% judges, 30% public vote.
 *
 *   judge average = each judge's weighted rubric score (0-100), averaged over the judges
 *   votes         = eligible public votes (see filterVotes)
 *
 * Both parts are put on the same scale before weighting: in each part the best entry gets 100 points
 * and the weakest gets 0. Judges' averages tend to bunch together (say 70-88) while vote counts spread
 * widely; without this step the public would outweigh the judges despite having only 30%.
 *
 *   final = 0.7 x judge points + 0.3 x public points
 *
 * Ties are broken by the judge average, then by earlier submission.
 * Pure functions with no NodeBB imports. This is the first piece of the contests plugin (phase 2).
 */

const DEFAULT_RUBRIC = Object.freeze([
	{ key: 'readability', label: 'קריאות', weight: 30, max: 10 },
	{ key: 'hierarchy', label: 'היררכיה טיפוגרפית', weight: 25, max: 10 },
	{ key: 'accuracy', label: 'דיוק (ניקוד, נוסח)', weight: 25, max: 10 },
	{ key: 'creativity', label: 'יצירתיות', weight: 20, max: 10 },
]);

const DEFAULT_OPTIONS = Object.freeze({
	judgesWeight: 0.7, // the public gets the rest (0.3)
	minVoterTier: 2, // trust tier "Letter" and up may vote
	maxVotesPerVoter: 3, // each voter may support up to 3 different entries
});

/** Round half-up to 2 decimals for display. 69.225 must show as 69.23, not 69.22 (binary 69.22499999...). */
function round2(n) {
	if (!Number.isFinite(n) || Math.abs(n) < 0.005) {
		return 0;
	}
	const clean = Number(n.toPrecision(12)); // drop floating-point noise first
	return Number(`${Math.round(Number(`${clean}e2`))}e-2`);
}

/** One judge's sheet for one entry -> 0..100. Missing or out-of-range criteria count as 0 or max. */
function rubricScore(scores, rubric = DEFAULT_RUBRIC) {
	const totalWeight = rubric.reduce((sum, c) => sum + c.weight, 0);
	if (!totalWeight) {
		return 0;
	}
	const weighted = rubric.reduce((sum, c) => {
		const raw = Number(scores && scores[c.key]);
		const value = Number.isFinite(raw) ? Math.min(c.max, Math.max(0, raw)) : 0;
		return sum + (c.weight * value / c.max);
	}, 0);
	return (weighted / totalWeight) * 100;
}

/**
 * Keep only votes that count. Rules:
 *  - voter tier >= minVoterTier          (reason: 'tier')
 *  - not for your own entry               (reason: 'self')
 *  - judges do not vote                   (reason: 'judge')
 *  - one vote per voter per entry         (reason: 'duplicate')
 *  - at most maxVotesPerVoter per voter, earliest first (reason: 'limit')
 *  - only for entries in the contest      (reason: 'unknown-entry')
 */
function filterVotes(votes, entries, judgeUids, options) {
	const entryById = new Map(entries.map(e => [String(e.id), e]));
	const judges = new Set(judgeUids.map(String));
	const perVoter = new Map();
	const counted = [];
	const rejected = { tier: 0, self: 0, judge: 0, duplicate: 0, limit: 0, 'unknown-entry': 0 };

	const ordered = [...votes].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
	for (const vote of ordered) {
		const entry = entryById.get(String(vote.entryId));
		const voter = String(vote.voterUid);
		const seen = perVoter.get(voter) || new Set();
		let reason = null;
		if (!entry) {
			reason = 'unknown-entry';
		} else if ((vote.voterTier || 0) < options.minVoterTier) {
			reason = 'tier';
		} else if (String(entry.uid) === voter) {
			reason = 'self';
		} else if (judges.has(voter)) {
			reason = 'judge';
		} else if (seen.has(String(entry.id))) {
			reason = 'duplicate';
		} else if (seen.size >= options.maxVotesPerVoter) {
			reason = 'limit';
		}
		if (reason) {
			rejected[reason] += 1;
		} else {
			seen.add(String(entry.id));
			perVoter.set(voter, seen);
			counted.push(vote);
		}
	}
	return { counted, rejected };
}

/** Scale values so the highest is 100 and the lowest 0. If all are equal, nobody gains: all get 100 (or 0 if all are 0). */
function toPoints(values) {
	const max = Math.max(...values);
	const min = Math.min(...values);
	if (max === min) {
		return values.map(() => (max > 0 ? 100 : 0));
	}
	return values.map(v => ((v - min) / (max - min)) * 100);
}

/**
 * entries:  [{ id, uid, submittedAt?, disqualified? }]
 * sheets:   [{ judgeUid, entryId, scores: { readability: 8, ... } }]
 * votes:    [{ voterUid, voterTier, entryId, timestamp? }]
 * Returns {
 *   results: [{ id, uid, rank, final, judge: { average, points, sheets }, public: { votes, points } }],
 *   votes: { counted, rejected }, warnings
 * }
 */
function scoreContest({ entries, sheets = [], votes = [], judges = [], rubric = DEFAULT_RUBRIC, options = {} }) {
	options = { ...DEFAULT_OPTIONS, ...options };
	const publicWeight = 1 - options.judgesWeight;
	const eligible = entries.filter(e => !e.disqualified);
	const judgeUids = judges.length ? judges.map(String) : [...new Set(sheets.map(s => String(s.judgeUid)))];
	const warnings = [];

	// judge component
	const judgeScore = new Map();
	const sheetCount = new Map();
	for (const entry of eligible) {
		const mine = sheets.filter(s => String(s.entryId) === String(entry.id) && judgeUids.includes(String(s.judgeUid)));
		const byJudge = new Map(mine.map(s => [String(s.judgeUid), s])); // last sheet per judge wins
		const values = [...byJudge.values()].map(s => rubricScore(s.scores, rubric));
		judgeScore.set(entry.id, values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
		sheetCount.set(entry.id, values.length);
		const missing = judgeUids.filter(uid => !byJudge.has(uid));
		if (missing.length) {
			warnings.push(`entry ${entry.id}: no score yet from judge(s) ${missing.join(', ')}`);
		}
	}

	// public component
	const { counted, rejected } = filterVotes(votes, eligible, judgeUids, options);
	const voteCount = new Map(eligible.map(e => [e.id, 0]));
	counted.forEach((vote) => {
		const entry = eligible.find(e => String(e.id) === String(vote.entryId));
		voteCount.set(entry.id, voteCount.get(entry.id) + 1);
	});
	if (!counted.length) {
		warnings.push('no eligible public votes: results are decided by the judges alone');
	}

	const judgePoints = toPoints(eligible.map(e => judgeScore.get(e.id)));
	const publicPoints = toPoints(eligible.map(e => voteCount.get(e.id)));

	const results = eligible.map((entry, i) => ({
		id: entry.id,
		uid: entry.uid,
		submittedAt: entry.submittedAt || 0,
		judge: { average: judgeScore.get(entry.id), points: judgePoints[i], sheets: sheetCount.get(entry.id) },
		public: { votes: voteCount.get(entry.id), points: publicPoints[i] },
		final: (options.judgesWeight * judgePoints[i]) + (publicWeight * publicPoints[i]),
	}));

	results.sort((a, b) => (b.final - a.final) || (b.judge.average - a.judge.average) ||
		(a.submittedAt - b.submittedAt) || String(a.id).localeCompare(String(b.id)));

	// rank on exact values first, round for display afterwards
	let rank = 0;
	results.forEach((r, i) => {
		const prev = results[i - 1];
		const tied = prev && prev.final === r.final && prev.judge.average === r.judge.average &&
			prev.submittedAt === r.submittedAt;
		rank = tied ? rank : i + 1;
		r.rank = rank;
	});
	results.forEach((r) => {
		r.final = round2(r.final);
		r.judge.average = round2(r.judge.average);
		r.judge.points = round2(r.judge.points);
		r.public.points = round2(r.public.points);
		delete r.submittedAt;
	});

	return { results, votes: { counted: counted.length, rejected }, warnings };
}

module.exports = { DEFAULT_RUBRIC, DEFAULT_OPTIONS, rubricScore, filterVotes, toPoints, scoreContest };
