# Git Safety Rules

These rules govern every git/GitHub operation on this repository, including operations performed through the GitHub web UI (this environment has no local clone or push credentials — see `.claude/playbooks/deploy-without-git-cli.md`).

## Hard restrictions

- Never create tags.
- Never create releases.
- Never merge branches.
- Never delete branches.
- Never force push.
- Never rewrite git history (no rebase, no `commit --amend` on already-pushed commits, no `reset --hard` followed by push).
- Never commit unless explicitly instructed for that specific change.

## Approval requirement

Git operations require explicit user approval. Approval is per change — approving one commit, tag, or release does not authorize the next one. When in doubt, stop and ask before taking the action, not after.

## Why this matters

`main` auto-deploys to production (Vercel) on every push. Tags and releases mark points other tooling or people may rely on; merges, force-pushes, and history rewrites can silently break or hide changes, and are difficult to undo cleanly even when GitHub shows an "undo" option. Treat every git-affecting action as effectively irreversible.

## Note on repo history

`v1.0-platform-foundation` (tag + release, commit `bf12f48`) was created before this rules file existed. It predates this policy and was not created in violation of it, but going forward no further tags or releases should be created without explicit instruction.
