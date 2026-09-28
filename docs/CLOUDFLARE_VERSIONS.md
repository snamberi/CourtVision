# Versions on Cloudflare: see them, test them, undo them

A short guide to how updates reach **courtvisiongame.com**, and what to do when one goes wrong.

## How an update goes live

1. Code changes are made on a branch and opened as a **pull request** on GitHub.
2. You **merge** the pull request into `main`.
3. Cloudflare sees the new commit on `main`, runs `npm run build`, then `npx wrangler deploy`.
4. That creates a new **version** of the `courtvision` Worker and sends 100% of visitors to it. It takes about 2–4 minutes.

Nothing reaches the site until something is merged into `main`. Pushing to a branch or opening a pull request doesn't change the live game.

## See every version

Cloudflare dashboard → **Workers & Pages** → **courtvision** → **Deployments**.

- The **Active deployment** at the top is what players get right now.
- **Version History** lists earlier versions: the newest 100 are kept. Each one shows its date and the Git commit it came from.
- **View build history** (bottom of the page) shows every build. Open a build to see its log if one failed.

## Undo a bad update (roll back)

If the site breaks after an update:

1. **Deployments** → find the last version that worked (the one just below the newest, usually).
2. Click the **⋯** menu on its row → **Rollback** → confirm.

The site switches back within seconds. Rolling back doesn't touch:
- players' saves (they're in their browsers);
- accounts and leaderboards (they're in Supabase);
- the Variables and Secrets.

**Then fix `main` too.** A rollback only changes what's live. The next merge into `main` builds from `main` again, bad code included. On GitHub, open the merged pull request and click **Revert**. That makes a new pull request that takes the change back out; merge it. After that, `main` and the live site match again.

From a terminal with Wrangler logged in, the same things are:

```
npx wrangler deployments list      # what's been live, newest first
npx wrangler versions list         # the recent versions and their IDs
npx wrangler rollback              # back to the version before the current one
npx wrangler rollback <VERSION_ID> # back to a specific version
```

## Try an update before it goes live

- **Preview builds:** with preview builds switched on (**Settings → Builds → Branch control**), every pull request gets its own build and a preview link. Cloudflare posts the link as a comment on the pull request. Open it, play a bit, then merge. The preview build currently fails on the PR branch; the fix is in the Cloudflare comment on the pull request.
- **Merge small:** one pull request per change makes it easy to tell which update caused a problem and to revert just that one.

## Quick answers

| Question | Answer |
|---|---|
| Did my update go live? | **Deployments** → the Active deployment's commit matches the one you merged. |
| A build failed. Is the site down? | No. A failed build doesn't deploy, so the last good version stays live. |
| Can I go back further than one version? | Yes, to any of the last 100 versions. |
| Will a rollback lose leaderboard scores or accounts? | No. Those live in Supabase, which a rollback doesn't touch. |
| I changed a Variable. Do I need to redeploy? | Runtime Variables and Secrets apply right away. **Build** variables (like `SUPABASE_URL`) need a new build: **Deployments → Retry build**, or merge anything. |
