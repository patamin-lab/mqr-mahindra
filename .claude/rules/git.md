# Git Safety Rules

These rules govern every git/GitHub operation on this repository, including operations performed through the GitHub web UI (this environment has no local clone or push credentials — see `.claude/playbooks/deploy-without-git-cli.md`).

## Hard restrictions (no exception, ever)

- Never create tags.
- Never create releases.
- Never force push.
- Never rewrite git history (no rebase, no `commit --amend` on already-pushed commits, no `reset --hard` followed by push).
- Never commit unless explicitly instructed for that specific change.

## Conditional operations (merge / branch deletion)

Merging a branch and deleting a branch are **not** blanket-forbidden, but each requires every one of its own conditions to hold — if any single condition is unmet, stop and report the blocker instead of proceeding. Meeting the conditions for one operation does not carry over to the other; each still needs its own explicit approval.

**Merge a PR only when ALL of the following hold:**

- The Product Owner has explicitly approved merging *this specific PR*, in this session — an earlier approval for a different PR, or a general "yes go ahead," does not count.
- The PR reports a clean, conflict-free mergeable state (e.g. GitHub's `mergeable: MERGEABLE` / `mergeStateStatus: CLEAN`), verified freshly, not assumed from an earlier check.
- Every required CI check reports green, verified freshly.
- The architecture check passes.
- The build passes.
- Use the repository's standard configured merge method (whatever GitHub's branch/PR settings default to for this repo) — never override it with an ad hoc strategy.

**Delete a branch only when ALL of the following hold:**

- That branch's PR was just merged successfully under the rule above.
- The Product Owner has explicitly approved deleting *that branch* — merge approval does not by itself imply delete approval; if the approval message didn't clearly cover deletion, ask before deleting.

## Approval requirement

Git operations require explicit user approval. Approval is per change — approving one commit, tag, release, merge, or branch deletion does not authorize the next one. When in doubt, stop and ask before taking the action, not after.

## Why this matters

`main` auto-deploys to production (Vercel) on every push. Tags and releases mark points other tooling or people may rely on; force-pushes and history rewrites can silently break or hide changes, and are difficult to undo cleanly even when GitHub shows an "undo" option — these stay absolute, no-exception restrictions. Merges and branch deletions are the most common legitimate end-of-review actions, so rather than forbidding them outright, this file gates them behind the same evidence a human reviewer would want before clicking the same buttons: fresh mergeability, fresh green CI, a fresh passing build and architecture check, and an explicit, specific approval. Treat every git-affecting action as effectively irreversible, conditional gate or not.

## Note on repo history

`v1.0-platform-foundation` (tag + release, commit `bf12f48`) was created before this rules file existed. It predates this policy and was not created in violation of it, but going forward no further tags or releases should be created without explicit instruction.
