# Claude Code Instructions

## Deployment Workflow

**Always work on a feature branch and open a PR into `staging` — never push directly to `staging` or `main`.**

1. Create a feature branch from `staging` (e.g. `feature/description`)
2. Make changes on the feature branch
3. Open a PR from the feature branch into `staging`
4. Staging deploys automatically for review — share with client or review yourself
5. Once approved, merge `staging` into `main` for production

### Branch structure
- `main` — production (live site)
- `staging` — staging/preview environment (review before going live)
- `feature/*` — short-lived branches for individual changes, always PR'd into `staging`

### Example flow
```bash
git checkout -b feature/my-change origin/staging
# ... make changes ...
git push origin feature/my-change
gh pr create --base staging --title "My change" --body "..."
# ... review on staging, get client approval ...
# ... merge staging into main when ready to go live ...
```

Never push directly to `staging` or `main`.

## Keeping Staging in Sync with Main

After every `staging` → `main` merge, fast-forward staging to match main:

```bash
git push origin origin/main:refs/heads/staging
```

This prevents the "1 commit behind" drift on GitHub. Always run this after a production deploy.

## Local Preview Setup

This is a static site (no build step). To preview locally:

1. Copy files to `/tmp/fortera-site` (avoids macOS sandbox permission errors in worktrees):
```bash
mkdir -p /tmp/fortera-site/assets /tmp/fortera-site/.claude
cp index.html styles.css main.js /tmp/fortera-site/
cp -r assets/ /tmp/fortera-site/assets/
```

2. Create `.claude/launch.json` in the worktree:
```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "fortera-homes",
      "runtimeExecutable": "bash",
      "runtimeArgs": ["-c", "cd /tmp/fortera-site && python3 -m http.server $PORT"],
      "port": 4200,
      "autoPort": true
    }
  ]
}
```

3. Use `preview_start` with name `"fortera-homes"`.

4. After every CSS/HTML/JS edit, sync changes before taking screenshots:
```bash
cp index.html styles.css main.js /tmp/fortera-site/
cp -r assets/ /tmp/fortera-site/assets/
```

**Important:** The preview panel renders at ~632px wide (mobile breakpoint). Desktop layout requires viewport ≥ 860px. Always use `preview_eval` to check `window.innerWidth` when debugging layout issues.
