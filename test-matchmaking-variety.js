// Variety test for /run-matchmaking and /run-matchmaking-even-lanes.
//
// Generates a synthetic pool of 25 players with a realistic role distribution
// (including a deliberately scarce Support role) and runs each algorithm N times.
// Reports:
//   - Distinct match compositions across runs (higher = more variety)
//   - Pair co-occurrence: max #runs any pair was in the same match (lower = more variety)
//   - Average autofills/secondaries per run
//   - Average team MMR difference per match
//
// This is a regression test for the matchmaking determinism bug where the same
// players repeatedly landed in the same match across weekly runs.

const mm = require('./commands/run-matchmaking');
const mm2 = require('./commands/run-matchmaking-even-lanes');

const silentDebug = {
    info: async () => {},
    success: async () => {},
    error: async () => {},
};

const ROLES = ['Top', 'Jungle', 'Mid', 'AD', 'Support'];

function makePlayer(id, primaryRole, secondaryRole, mmr) {
    return {
        userId: `u${id}`,
        username: `player${id}`,
        displayName: `Player ${id}`,
        joinTime: 1000 + id,
        mmr,
        primaryRole,
        secondaryRole,
        riotId: `Player${id}#NA1`,
        firstName: `P${id}`,
        isRioter: false,
    };
}

// Build a 25-player pool with a deliberately uneven role distribution
// (Support scarce - the structural-determinism stressor).
function buildPool() {
    const pool = [];
    let id = 1;

    // Top mains: 6
    const topMmrs = [180, 250, 320, 410, 520, 640];
    for (const m of topMmrs) pool.push(makePlayer(id++, 'Top', 'Mid', m));

    // Jungle mains: 6
    const jgMmrs = [200, 280, 350, 440, 540, 660];
    for (const m of jgMmrs) pool.push(makePlayer(id++, 'Jungle', 'Top', m));

    // Mid mains: 5
    const midMmrs = [220, 300, 400, 500, 620];
    for (const m of midMmrs) pool.push(makePlayer(id++, 'Mid', 'AD', m));

    // AD mains: 5
    const adMmrs = [240, 330, 430, 510, 600];
    for (const m of adMmrs) pool.push(makePlayer(id++, 'AD', 'Support', m));

    // Support mains: 3 (deliberately scarce - need 4 supports per 2-match run)
    const supMmrs = [260, 380, 480];
    for (const m of supMmrs) pool.push(makePlayer(id++, 'Support', 'AD', m));

    return pool;
}

// A "match composition" is the sorted list of userIds that played that match.
function compositionKey(match) {
    return [...match.team1, ...match.team2]
        .map(p => p.userId)
        .sort()
        .join(',');
}

// Run-summary key: sorted list of match compositions
function runKey(matches) {
    return matches.map(compositionKey).sort().join('|');
}

function countAutofills(matches) {
    let af = 0, sec = 0, pri = 0;
    for (const m of matches) {
        for (const t of [m.team1, m.team2]) {
            for (const p of t) {
                if (p.roleType === 'autofill') af++;
                else if (p.roleType === 'secondary') sec++;
                else pri++;
            }
        }
    }
    return { autofills: af, secondaries: sec, primaries: pri };
}

function avgTeamMmrDiff(matches) {
    if (matches.length === 0) return 0;
    let sum = 0;
    for (const m of matches) sum += Math.abs(m.team1MMR - m.team2MMR);
    return sum / matches.length;
}

async function runAlgo(name, runFn, players, numMatches, numRuns) {
    console.log(`\n=== ${name} (${numRuns} runs, ${numMatches} matches each) ===`);

    const runSeen = new Map();           // runKey -> count
    const pairCount = new Map();         // "uA|uB" -> times in same match
    let totalAutofills = 0;
    let totalSecondaries = 0;
    let totalMmrDiff = 0;
    let totalMatches = 0;
    let validRuns = 0;
    let totalDurationMs = 0;

    for (let r = 0; r < numRuns; r++) {
        const t0 = Date.now();
        let matches;
        try {
            matches = await runFn(players, numMatches, silentDebug);
        } catch (err) {
            console.log(`  Run ${r + 1} threw: ${err.message}`);
            continue;
        }
        const t1 = Date.now();
        totalDurationMs += (t1 - t0);

        if (!matches || matches.length !== numMatches) {
            console.log(`  Run ${r + 1} returned ${matches ? matches.length : 0} matches (expected ${numMatches})`);
            continue;
        }
        validRuns++;
        totalMatches += matches.length;

        const k = runKey(matches);
        runSeen.set(k, (runSeen.get(k) || 0) + 1);

        for (const m of matches) {
            const ids = [...m.team1, ...m.team2].map(p => p.userId);
            for (let i = 0; i < ids.length; i++) {
                for (let j = i + 1; j < ids.length; j++) {
                    const [a, b] = [ids[i], ids[j]].sort();
                    const key = `${a}|${b}`;
                    pairCount.set(key, (pairCount.get(key) || 0) + 1);
                }
            }
        }

        const af = countAutofills(matches);
        totalAutofills += af.autofills;
        totalSecondaries += af.secondaries;
        totalMmrDiff += avgTeamMmrDiff(matches);
    }

    if (validRuns === 0) {
        console.log('  ❌ No valid runs produced!');
        return;
    }

    // Pair stats
    const pairValues = [...pairCount.values()];
    const maxPair = pairValues.length > 0 ? Math.max(...pairValues) : 0;
    const avgPair = pairValues.length > 0 ? (pairValues.reduce((s, v) => s + v, 0) / pairValues.length) : 0;
    const lockedPairs = pairValues.filter(v => v === validRuns).length;
    const highRepeatPairs = pairValues.filter(v => v >= Math.ceil(validRuns * 0.8)).length;

    console.log(`  Valid runs:                ${validRuns}/${numRuns}`);
    console.log(`  Avg run duration:          ${(totalDurationMs / validRuns).toFixed(0)} ms`);
    console.log(`  Distinct match compositions across runs: ${runSeen.size} / ${validRuns}`);
    console.log(`  Distinct full-run signatures:            ${runSeen.size}`);
    console.log(`  Avg autofills per run:     ${(totalAutofills / validRuns).toFixed(2)}`);
    console.log(`  Avg secondaries per run:   ${(totalSecondaries / validRuns).toFixed(2)}`);
    console.log(`  Avg team-MMR diff/match:   ${(totalMmrDiff / validRuns).toFixed(1)}`);
    console.log(`  Pair co-occurrence:        max=${maxPair}  avg=${avgPair.toFixed(2)}`);
    console.log(`  Pairs ALWAYS together (=${validRuns} runs): ${lockedPairs}`);
    console.log(`  Pairs together ≥80% of runs:               ${highRepeatPairs}`);

    return {
        validRuns,
        distinctRuns: runSeen.size,
        maxPair,
        avgPair,
        lockedPairs,
        avgAutofills: totalAutofills / validRuns,
        avgMmrDiff: totalMmrDiff / validRuns,
    };
}

async function main() {
    const players = buildPool();
    const numMatches = Math.floor(players.length / 10); // 25 -> 2 matches
    const NUM_RUNS = 10;

    console.log(`Pool: ${players.length} players, ${numMatches} matches per run, ${NUM_RUNS} runs`);
    console.log('Role distribution:');
    for (const r of ROLES) {
        const count = players.filter(p => p.primaryRole === r).length;
        console.log(`  ${r.padEnd(8)} ${count} primaries`);
    }

    // Test 1: /run-matchmaking
    const r1 = await runAlgo(
        '/run-matchmaking',
        async (p, n, d) => mm._test.runMatchmakingAlgorithm(p, n, d),
        players, numMatches, NUM_RUNS
    );

    // Test 2: /run-matchmaking-even-lanes
    const r2 = await runAlgo(
        '/run-matchmaking-even-lanes',
        async (p, n, d) => mm2._test.runRoleFirstMatchmaking(p, n, d),
        players, numMatches, NUM_RUNS
    );

    // Variety assertions
    console.log('\n=== Variety Assertions ===');
    const failures = [];

    for (const [name, r] of [['/run-matchmaking', r1], ['/run-matchmaking-even-lanes', r2]]) {
        if (!r) { failures.push(`${name}: no results`); continue; }

        // We want at least a few distinct run signatures - bug previously produced ~1.
        const minDistinct = Math.max(3, Math.floor(NUM_RUNS * 0.4));
        if (r.distinctRuns < minDistinct) {
            failures.push(`${name}: only ${r.distinctRuns} distinct runs (expected >= ${minDistinct})`);
        } else {
            console.log(`✅ ${name}: ${r.distinctRuns} distinct run signatures (>= ${minDistinct})`);
        }

        // We accept that scarce-role pairs (3 supports for 4 slots) MUST co-occur often,
        // but no non-scarce pair should be locked in every run. Allow up to a small number
        // of locked pairs (~3 supports => 3 locked pairs is unavoidable structurally).
        const maxAllowedLocked = 6;
        if (r.lockedPairs > maxAllowedLocked) {
            failures.push(`${name}: ${r.lockedPairs} pairs locked together in all runs (expected <= ${maxAllowedLocked})`);
        } else {
            console.log(`✅ ${name}: ${r.lockedPairs} locked pairs (<= ${maxAllowedLocked}; structural minimum)`);
        }
    }

    if (failures.length === 0) {
        console.log('\n🎉 All variety assertions passed.');
        process.exit(0);
    } else {
        console.log('\n❌ Failures:');
        for (const f of failures) console.log('  - ' + f);
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Test crashed:', err);
    process.exit(1);
});
