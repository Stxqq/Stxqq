# Public activity

The activity card is generated in this repository. It needs no external statistics service, tracking, or additional secret.

## Data

- Unauthenticated GitHub REST API; only explicitly public repositories owned by `Stxqq`, excluding forks.
- Commits on each repository's default branch, attributed using `author.login`.
- 365 calendar days, including today. Days and commit author timestamps use UTC.
- Duplicate commit SHAs count once.
- The automated commit `chore: refresh public profile activity [skip ci]` is excluded.
- Color levels represent 0, 1–2, 3–5, 6–9, and 10+ commits per day.
- The outlined cell marks today; its fill still represents the real commit count.

This is a **commit heatmap**. It does not include issues, pull requests, repositories owned by others, other branches, or private activity. It therefore differs from GitHub's contribution graph. Profile privacy settings are left unchanged.

## Rendering

The self-contained SVG uses layered translucent gradients, fine edge highlights, and blue glass cells. It works as a normal GitHub README image without scripts, external fonts, or animation. Counts remain legible over a dark glass surface.

## Updates

The workflow runs daily at 05:17 UTC, after a push to `main`, and on manual dispatch. GitHub may delay scheduled runs. The date on the card indicates the last successful data fetch.

API errors or incomplete responses stop the update and preserve the last successful card. The generator reads public data without a token; the workflow uses its write permission to commit the generated SVG as Stefan. Concurrent pushes are never overwritten: a failed push can be retried by the next run.

```sh
node --test scripts/update-activity.test.mjs
node scripts/update-activity.mjs
```

To run manually: **Actions → Public profile activity → Run workflow**. GitHub may disable scheduled workflows in public repositories after extended inactivity; they can be re-enabled there.

References: [GitHub REST: commits](https://docs.github.com/en/rest/commits/commits#list-commits), [GitHub Actions: scheduled workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
