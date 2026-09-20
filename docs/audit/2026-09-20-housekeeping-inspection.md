# Repository Housekeeping Inspection (read-only)

> **Status:** CURRENT (dated record) · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** `git worktree list`, `git branch -vv`, `git status`, `git diff`, `git ls-tree` run on 2026-09-20 · **Owner:** Engineering Lead
> **Nothing was deleted, moved, pruned, renamed, migrated or discarded.** This report answers owner decisions Q47–Q49 ("inspect only") and proposes actions that need **explicit written authorisation** before anyone executes them ([RD-15](../product/OWNER-DECISIONS.md#still-requires-decision-not-answered-by-the-owner)).

## 1. Worktrees
| Path | Registered in git? | State | Notes |
|---|---|---|---|
| repo root (`main`) | yes | `main` = `origin/main` (0 ahead/behind) | — |
| `.claude/worktrees/schoolos-design-chunk0` | yes, branch `worktree-schoolos-design-chunk0` @ `4ca272e` | clean (0 changes) | 0 commits ahead of `main` (its work is contained in `main`), 43 behind |
| `.claude/worktrees/staff-hiring-foundation-plan` | **no** (has a `.git` pointer but is absent from `git worktree list`) | not inspectable through git | stale/orphaned worktree directory; branch `worktree-staff-hiring-foundation-plan` @ `b23a2fb` is 0 ahead of `main` |
| `.claude/worktrees/ui-revamp-staff-console` | no (plain folder, no `.git`) | contains only `staff-console/` | not a worktree; contents not verified against `main` |
Ignored by `.gitignore:11` (`.claude/worktrees/`), so none of this is in history. Disk use: `schoolos-design-chunk0` ≈ 851 MB, `staff-hiring-foundation-plan` ≈ 15 MB, `ui-revamp-staff-console` ≈ 10 KB.

## 2. Branches
| Branch | Unique commits vs `main` | Upstream | Assessment |
|---|---|---|---|
| `rebrand/schoolos` | **0** (fully contained in `main`) | none | safe to delete once owner agrees |
| `worktree-schoolos-design-chunk0` | **0** | none | safe after its worktree is removed |
| `worktree-staff-hiring-foundation-plan` | **0** | none | safe after its worktree is removed |
| **`staff-hiring-console-ui`** | **1 — `8446ab8` "add Staff list and profile identity/contact/address pages"** | none | **unique, unpushed work — do NOT delete**; decide whether to merge/cherry-pick or keep |
| `origin/sprint-a-stabilization`, `origin/sprint-b/task-1-fee-payment-restrict` | 0 (merged into `origin/main`) | remote | safe to delete from the remote only with owner approval |
| tags | `docs-pre-cleanup` (local, created by the documentation program) | — | keep until the docs are committed |
| **`stash@{0}` "autostash"** | changes to `backend/prisma/seed.ts` (958 lines), `EntityTable.vue`, `EntityTable.spec.ts` | — | **unique work that exists nowhere else — do not drop**; needs review against `main` |
`main` has no unpushed commits (`origin/main..main` empty; HEAD = `origin/main` = `e4e9f27`).

## 3. Working-tree state (uncommitted)
- **Changed during the session (not by this pass):** at the start of the inspection there were 105 staged renames, 34 modified and ~79 untracked docs files. Later, commit **`e4e9f27` "docs: complete documentation and production-readiness program (phases 0-13)"** appeared on `main` and `origin/main` (author = repository owner, 14:55), capturing the staged moves, the new docs and the in-progress Phase 14 files. It moved `docs/UI-Screenshots/archive` into `docs/design-reference/UI-Screenshots/archive`. It did **not** include the two `sample4` CSV edits or any credentials from them (verified: no match for the pasted project URL/name in that commit).
- **Now (after that commit):** 66 modified tracked files (Phase 14 finishing edits + the two CSVs) and 3 untracked new files (`LICENSE`, this report, the gap-analysis plan). Nothing is staged.
- `main` = `origin/main` = `e4e9f27`; the earlier statement "no unpushed commits" still holds.
- Git warns about LF/CRLF conversion on several files (Windows `core.autocrlf`); no `.gitattributes` exists. This is not a defect but will produce noisy diffs unless a `.gitattributes` policy is set (proposal below).

## 4. `docs/UI-Screenshots/sample4/bulk-upload` — the two CSVs
Both `parents-sample (1).csv` and `parents-sample (1).csv.bak` carry **uncommitted appended text** (last edited 2026-09-19 23:52) that is **not CSV data**:
1. **Pasted output from an unrelated project** (a "tasktracker" Supabase seeding log): a Supabase project URL, five test accounts with UUIDs, and a **test password**. It is not SchoolOS data. **Treat as sensitive: it must not be committed** — recommend removing those lines (or rotating that project's credentials if it is live) after authorisation. This report intentionally does not reproduce the values.
2. **Three short bug notes about SchoolOS** (owner's own): (a) on the hiring approve dialog, prefill date of birth, CNIC, mobile, email and login e-mail; (b) in "Add Applicant → Application", the academic-session dropdown shows other schools' sessions; (c) in Admissions, dropdown labels missing and other schools' sessions shown. Recorded as **unverified owner-reported issues** in [KNOWN-ISSUES](../release/KNOWN-ISSUES.md) (KI-29); (b)/(c) are consistent with the global-session defect (KG-7/BL-01).
The committed parts of those files are ordinary sample bulk-upload data (parents/staff/students/teachers CSVs), which are legitimate design/QA samples — but check they contain no real people (BL-34 / Q10 principle).
**Proposed (needs authorisation):** keep the sample CSV rows; strip the two pasted blocks from both files; record the three UI notes as issues (done); rotate the unrelated project's secrets if still live.

## 5. Large files
Tracked design assets: `docs/design-reference/` ≈ 27 MB, `docs/UI-Screenshots/` ≈ 22 MB (working tree ≈ 23 MB / 28 MB on disk). Largest single files at `HEAD`: the "Student Profile Redesign" PDF/HTML pair (≈ 5.4–5.6 MB each, present in **both** `archive/` and `sample4/`), a 1.3 MB wireframe file, and a 1.3 MB student-profile file. Several `.zip` exports duplicate folders. The cleanup phase already staged moves of `UI-Screenshots/archive` (deletions at the old path).
**Proposed (needs authorisation):** (1) decide which comps are genuine product assets; (2) move retained binaries to Git LFS or external design storage; (3) drop duplicates (PDF/HTML present in both folders, zips duplicating folders); (4) keep screenshots only if reviewed for private data and approved for sharing (Q48). Note that binaries already in history stay in history unless the history is rewritten — **history rewriting is not proposed** and would need a separate decision.

## 6. Proposed clean-up actions (all pending authorisation, in safe order)
1. Keep: `staff-hiring-console-ui` branch and `stash@{0}` (unique work) — decide merge/keep/archive first.
2. Remove the two stale worktree directories and `git worktree prune`; then delete the three fully-merged local branches (`rebrand/schoolos`, `worktree-*`).
3. Delete the two merged remote branches (optional).
4. Clean the two CSVs as in §4, then commit them with the documentation set or drop them.
5. Add `.gitattributes` (line endings; LFS patterns) and migrate approved binaries.
6. Commit order requested by the owner: docs commits first, **repository clean-up last and separate**.
