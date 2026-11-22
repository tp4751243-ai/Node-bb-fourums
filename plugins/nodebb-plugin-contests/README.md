# nodebb-plugin-contests (in progress)

The contests plugin is phase 2 of the plan. Its first piece, the **scoring engine**, is done and tested:
[`lib/scoring.js`](lib/scoring.js).

## How a winner is decided: 70% judges, 30% public

1. **Judges** fill a rubric, 1–10 per criterion. Defaults: readability 30%, typographic hierarchy 25%,
   accuracy (nikud, text) 25%, creativity 20%. Each sheet becomes a 0–100 score, and the judges' scores are averaged.
2. **The public** votes. Only eligible votes count (see below).
3. **Both parts go on the same scale.** In each part, the best entry gets 100 points and the weakest gets 0.
4. **Final score = 0.7 × judge points + 0.3 × public points.** Ties go to the higher judge average, then to the earlier submission.

Step 3 is what makes "70/30" true in practice. Judges' averages tend to bunch together (say 70–88), while
vote counts spread widely. If raw judge averages were mixed with vote counts, the public's 30% would end up
outweighing the judges.

What that means for members (each case is a test):

- When judges and public disagree head to head, the **judges' pick wins** (70 to 30).
- When the judges are nearly split (85 vs 84), **the public decides**.
- A clear judge lead survives even a strong public preference.

**Who can vote** (enforced by the engine):

- members at trust tier 2 (Letter) or higher
- not for their own entry
- judges don't vote, because they already score
- one vote per entry, at most 3 entries per voter (the earliest 3 count)

## Until the plugin exists

Run contests by hand:

1. Announce the contest in the תחרויות category.
2. Collect entries privately.
3. After the deadline, publish the entries.
4. Let tier 2+ members upvote. The bootstrap already limits upvotes in that category to tier 2+.

```bash
npm test
```
