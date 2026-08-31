# Matchmaking Even Lanes Algorithm Update

## 🎯 Update Date: October 23, 2025

## Overview
Complete rewrite of the role assignment algorithm for `/run-matchmaking-even-lanes` command to optimize player role assignments based on three priority factors.

---

## 🆕 New Algorithm Features

### Three-Priority Scoring System (Lexicographic Ordering)

The algorithm now evaluates role assignments using strict priority ordering:

1. **Priority 1: Minimize Autofills** (Highest Priority)
   - Players assigned to roles outside their primary/secondary preferences
   - Autofilled players receive 85% MMR penalty

2. **Priority 2: Minimize Secondaries**
   - Players assigned to their secondary role preference
   - No MMR penalty applied

3. **Priority 3: Minimize MMR Variance** (Lowest Priority)
   - Ensures players assigned to the same role have similar MMR
   - Calculated using statistical variance per role
   - Promotes balanced lane matchups

### Iterative Optimization Process

- **1000 iterations** (increased from 500)
- Each iteration generates a complete role assignment
- Uses lexicographic comparison to strictly prioritize factors
- Only replaces best solution when strictly better on priority hierarchy

---

## 🔧 Technical Implementation

### Key Algorithm Components

#### 1. **createOptimizedRoleAssignment()**
- Shuffles player pool for randomness across iterations
- Builds separate pools for primary/secondary/autofill candidates per role
- Sorts each pool by MMR for balanced selection
- Processes roles in random order to vary assignments
- Uses `selectPlayersEvenly()` to distribute players across MMR spectrum

#### 2. **selectPlayersEvenly()**
- Selects players evenly across the sorted MMR range
- Minimizes variance by avoiding clustering
- Adds slight randomness (±30%) to prevent identical selections
- Example: For 10 players with MMR [100,200,300,400,500], selecting 5 would pick indices [0,2,4,6,8] with random offset

#### 3. **scoreRoleAssignment()**
- Counts total autofills across all roles
- Counts total secondaries across all roles
- Calculates MMR variance per role using statistical formula:
  ```
  variance = Σ(MMR - avgMMR)² / count
  ```
- Returns score object: `{autofills, secondaries, mmrVariance}`

#### 4. **Lexicographic Comparison**
```javascript
const isBetter = 
    score.autofills < bestScore.autofills ||
    (score.autofills === bestScore.autofills && score.secondaries < bestScore.secondaries) ||
    (score.autofills === bestScore.autofills && score.secondaries === bestScore.secondaries && score.mmrVariance < bestScore.mmrVariance);
```

---

## 📊 Algorithm Behavior

### Role Assignment Strategy

For each role in random order:
1. **Primary Assignment**
   - Select players whose primary role matches (or Fill)
   - Use `selectPlayersEvenly()` to choose across MMR spectrum
   - Mark players as assigned

2. **Secondary Backfill**
   - If role not full, select from secondary role matches (or Fill)
   - Again use even distribution across MMR range
   - Mark additional players as assigned

3. **Autofill Remaining**
   - If still not full, select from all unassigned players
   - Apply 85% MMR penalty to effectiveMMR
   - Mark final players as assigned

### MMR Variance Calculation

For each role's assigned players:
```
mmrs = [player1.mmr, player2.mmr, ..., playerN.mmr]
avgMMR = sum(mmrs) / N
variance = sum((mmr - avgMMR)² for mmr in mmrs) / N
totalMMRVariance = sum of all role variances
```

Lower variance = more similar MMRs within the same role

---

## 📈 Expected Improvements

### Compared to Previous Algorithm

| Metric | Previous | New Algorithm |
|--------|----------|---------------|
| **Iterations** | 500 scenarios | 1000 iterations |
| **Selection Strategy** | Random shuffle | Even MMR distribution |
| **MMR Consideration** | None | Variance minimization (Priority 3) |
| **Priority System** | Autofills > Secondaries | Autofills > Secondaries > MMR Variance |
| **Logging Detail** | Basic counts | Includes MMR variance and avg MMR per role |

### Benefits

1. **Fewer Autofills**: Prioritized above all else
2. **Fewer Secondaries**: Second most important factor
3. **Balanced Lanes**: Players in same role have similar skill levels
4. **Better Match Quality**: Similar MMR leads to competitive lanes
5. **Transparent Scoring**: Clear metrics for optimization success

---

## 🎮 User-Visible Changes

### Enhanced Debug Logging

```
**Matchmaking2**: Iteration 200/1000 | Best: 2 autofills, 8 secondaries, 1245.67 MMR variance

**Matchmaking2**: ✅ Best assignment found: 2 autofills, 8 secondaries, 1245.67 MMR variance

**Matchmaking2**: 📋 Final Role Assignment Summary:
  • Top: 8p/2s/0a (avg MMR: 425.0)
  • Jungle: 7p/3s/0a (avg MMR: 410.5)
  • Mid: 9p/1s/0a (avg MMR: 450.3)
  • AD: 6p/3s/1a (avg MMR: 398.2)
  • Support: 8p/1s/1a (avg MMR: 415.8)
```

Legend: `p` = primary, `s` = secondary, `a` = autofill

---

## 🚀 Deployment Information

**Deployed to Fly.io:**
- **Date**: October 23, 2025
- **App Name**: discord-fight-night-bot-andre
- **Version**: 33
- **Region**: Dallas (dfw)
- **Status**: ✅ Running

### Verify Deployment
```bash
flyctl status --app discord-fight-night-bot-andre
flyctl logs --app discord-fight-night-bot-andre
```

---

## 🧪 Testing Recommendations

1. Run `/run-matchmaking-even-lanes` with various player pool sizes
2. Compare autofill/secondary counts to previous algorithm
3. Check MMR variance values in debug channel
4. Verify lane matchups have similar MMR players
5. Monitor match quality feedback from players

---

## 📝 Code Location

**File**: `commands/run-matchmaking-even-lanes.js`

**Modified Functions**:
- `assignRolesToPlayers()` - Lines 248-338
- `createOptimizedRoleAssignment()` - Lines 340-446
- `selectPlayersEvenly()` - Lines 448-463
- `scoreRoleAssignment()` - Lines 465-493

---

## 🎯 Success Criteria

The new algorithm is successful if:
- ✅ Autofills are minimized (Priority 1)
- ✅ Secondaries are minimized when autofills are equal (Priority 2)
- ✅ Players in same role have similar MMR (Priority 3)
- ✅ Algorithm completes in reasonable time (<10 seconds for 50 players)
- ✅ Match quality improves based on player feedback

---

**Algorithm Update Completed Successfully! 🎉**
