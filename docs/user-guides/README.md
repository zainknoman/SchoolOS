# User Guides

> **Status:** PARTIAL · **Verified:** 2026-09-20 against `main@15362b7` · **Owner:** project owner
> Task-oriented guides for the roles that exist. **Verification level:** steps are derived from the router (`staff-console/src/router/index.ts`), Flutter screens, API behaviour and business rules; they were **not click-tested in a running UI** in this pass, so exact button/field wording may differ slightly. No screenshots are included (decision G10: comps in `docs/design-reference/` are design mock-ups, not the shipped UI, and may show demo personal data).
> Features that need external services are flagged **⚠ needs setup** — a school should not promise them to users until an administrator has configured them ([INTEGRATIONS](../operations/INTEGRATIONS.md)).

| Guide | Audience | Surface |
|---|---|---|
| [SUPER-ADMIN-GUIDE](SUPER-ADMIN-GUIDE.md) | Network/platform administrators | Staff console |
| [SCHOOL-ADMIN-GUIDE](SCHOOL-ADMIN-GUIDE.md) | School administrators and principals | Staff console |
| [ACCOUNTS-GUIDE](ACCOUNTS-GUIDE.md) | Accounts / fee staff | Staff console |
| [TEACHER-GUIDE](TEACHER-GUIDE.md) | Teachers | Staff console |
| [PARENT-GUIDE](PARENT-GUIDE.md) | Parents / guardians | Parent app |

There is **no student guide**: students have no login. Sign-in for every staff role: staff console → **Log in** (email or identifier + password). After 5 wrong attempts the account is locked for 15 minutes. **Forgot password** sends an email link (⚠ needs SMTP; otherwise no email is sent). **Change password** is available after sign-in.
