'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const tiers = require('../lib/tiers');

const NOW = Date.UTC(2026, 10, 22);
const daysAgo = days => NOW - (days * tiers.DAY_MS);
const config = tiers.normalizeSettings({});

function user(overrides) {
	return { postcount: 0, reputation: 0, joindate: daysAgo(0), emailConfirmed: true, banned: false, ...overrides };
}

test('new member starts at tier 1 (Dot)', () => {
	assert.deepEqual(tiers.computeTier(user(), config, NOW), { tier: 1, reason: 'earned' });
});

test('5 posts with a confirmed email reaches tier 2 and can post jobs', () => {
	assert.equal(tiers.computeTier(user({ postcount: 4 }), config, NOW).tier, 1);
	assert.equal(tiers.computeTier(user({ postcount: 5 }), config, NOW).tier, 2);
});

test('tier 2 requires a confirmed email unless the setting is off', () => {
	assert.equal(tiers.computeTier(user({ postcount: 5, emailConfirmed: false }), config, NOW).tier, 1);
	const relaxed = tiers.normalizeSettings({ requireEmail: 'off' });
	assert.equal(tiers.computeTier(user({ postcount: 5, emailConfirmed: false }), relaxed, NOW).tier, 2);
});

test('higher tiers need posts, reputation AND account age', () => {
	const veteran = user({ postcount: 400, reputation: 250, joindate: daysAgo(200) });
	assert.equal(tiers.computeTier(veteran, config, NOW).tier, 5);
	assert.equal(tiers.computeTier({ ...veteran, joindate: daysAgo(100) }, config, NOW).tier, 4);
	assert.equal(tiers.computeTier({ ...veteran, reputation: 20 }, config, NOW).tier, 3);
	assert.equal(tiers.computeTier({ ...veteran, joindate: daysAgo(3) }, config, NOW).tier, 2);
});

test('tiers are cumulative: failing tier 3 stops promotion even if tier 4 numbers are met', () => {
	const custom = tiers.normalizeSettings({ t3_days: '30', t4_days: '0' });
	// t4_days is raised to 30 because thresholds are forced non-decreasing
	assert.equal(custom.tiers[3].days, 30);
	const fast = user({ postcount: 150, reputation: 80, joindate: daysAgo(10) });
	assert.equal(tiers.computeTier(fast, custom, NOW).tier, 2);
});

test('banned users have no tier; overrides win over earned tiers', () => {
	assert.deepEqual(tiers.computeTier(user({ banned: true, postcount: 999 }), config, NOW), { tier: 0, reason: 'banned' });
	assert.deepEqual(tiers.computeTier(user({ override: 4 }), config, NOW), { tier: 4, reason: 'override' });
	assert.equal(tiers.computeTier(user({ override: 9 }), config, NOW).tier, 5);
});

test('net-negative reputation blocks tier 2+ unless admins allow a tolerance', () => {
	const downvoted = user({ postcount: 500, reputation: -3, joindate: daysAgo(400) });
	assert.deepEqual(tiers.computeTier(downvoted, config, NOW), { tier: 1, reason: 'earned' });
	const tolerant = tiers.normalizeSettings({ t2_reputation: '-5' });
	assert.equal(tolerant.tiers[1].reputation, -5);
	assert.equal(tiers.computeTier(downvoted, tolerant, NOW).tier, 2);
});

test('progress reports exactly what is missing for the next tier', () => {
	const p = tiers.progress(user({ postcount: 3 }), config, NOW);
	assert.equal(p.tier, 1);
	assert.equal(p.next.tier, 2);
	assert.deepEqual(p.next.missing, { posts: 2, reputation: 0, days: 0, email: false });

	const top = tiers.progress(user({ postcount: 400, reputation: 250, joindate: daysAgo(200) }), config, NOW);
	assert.equal(top.tier, 5);
	assert.equal(top.next, null);
});

test('settings: custom names, jobs categories, bad numbers fall back to defaults', () => {
	const s = tiers.normalizeSettings({ t2_name: 'אות מתחיל', t2_posts: 'abc', jobsCids: '12, 13 13,x', jobsAutoApproveTier: '4' });
	assert.equal(s.tiers[1].name, 'אות מתחיל');
	assert.equal(s.tiers[1].posts, 5);
	assert.deepEqual(s.jobsCids, [12, 13]);
	assert.equal(s.jobsAutoApproveTier, 4);
	assert.equal(s.queueExemptTier, 2);
});

test('overrides parse usernames and uids, ignore comments and junk', () => {
	const map = tiers.parseOverrides('# verified publishers\nHotzaat_Or = 4\nuid:17: 2\nbad line\nfoo = 7');
	assert.equal(map.get('hotzaat_or'), 4);
	assert.equal(map.get('uid:17'), 2);
	assert.equal(map.size, 2);
});

test('badges: default to the tier badge, swap on promotion, respect user choices', () => {
	const groups = tiers.allGroupNames();
	// never chosen -> show the tier badge
	assert.equal(tiers.nextGroupTitle(null, 'trust-tier-2', groups), '["trust-tier-2"]');
	// promotion swaps the badge in place and keeps other badges
	assert.equal(
		tiers.nextGroupTitle('["Verified Typesetter","trust-tier-2"]', 'trust-tier-3', groups),
		'["Verified Typesetter","trust-tier-3"]'
	);
	// user shows only other badges -> leave alone
	assert.equal(tiers.nextGroupTitle('["Verified Typesetter"]', 'trust-tier-3', groups), '["Verified Typesetter"]');
	// user hid all badges -> leave alone
	assert.equal(tiers.nextGroupTitle('', 'trust-tier-3', groups), '');
	assert.equal(tiers.nextGroupTitle('[]', 'trust-tier-3', groups), '[]');
	// ban removes the tier badge
	assert.equal(tiers.nextGroupTitle('["trust-tier-4"]', null, groups), null);
});
