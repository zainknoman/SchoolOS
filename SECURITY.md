# Security Policy

> **Status:** PARTIAL (placeholders pending owner inputs) · **Verified:** 2026-09-20 · **Owner:** Security Owner (Engineering Lead until a dedicated security owner is assigned) · SchoolOS is **pre-production**; see [`docs/security/SECURITY-OVERVIEW.md`](docs/security/SECURITY-OVERVIEW.md) and [`docs/security/KNOWN-GAPS.md`](docs/security/KNOWN-GAPS.md).

## Reporting a vulnerability
Report security issues **privately**. **Do not open public GitHub issues** and do not post exploit details publicly.

- **Contact:** `security@[production-domain]` — **placeholder**. The production domain and mailbox are not yet finalised (owner decision, 2026-09-20; open item RD-2). Until the real address is published here, report through the repository owner or GitHub's private vulnerability reporting if the owner has enabled it (<https://github.com/zainknoman/SchoolOS>). No real address is invented in this file.
- Include: affected component, steps to reproduce, impact, and any logs with personal data removed.
- Handling is private and coordinated by the Security Owner. Response-time targets are not yet defined (to be set with the support process, before production).

## Supported versions
No versions have been released or tagged. The first production release will be **1.0.0** under Semantic Versioning ([release checklist](docs/release/RELEASE-CHECKLIST.md)). Until then only `main` is maintained.

## Scope notes
SchoolOS handles children's and families' personal data. No claim of legal or regulatory compliance is made until qualified legal counsel has reviewed the applicable Pakistani requirements ([DATA-PROTECTION](docs/security/DATA-PROTECTION.md)). Known issues are already listed in `docs/security/KNOWN-GAPS.md`; reports about them are still welcome if they add new impact or a reproduction.
