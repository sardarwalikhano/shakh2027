# SHAKH STORE — M00–M11 modernization roadmap

This roadmap tracks the approved marketplace requirements. A phase is marked complete only when its code, database dependencies and applicable end-to-end tests are verified. A merged SQL migration file is not proof that production schema has been changed.

| Phase | Workstream | Status | Evidence / dependency |
| --- | --- | --- | --- |
| M00 | Project foundation, infrastructure, design system, CI and PWA shell | Complete | Next.js/TypeScript foundation, Vercel production project, canonical domain, GitHub CI, localization and offline shell |
| M01 | Identity, authentication, profile and database-backed roles | Complete foundation | Signup, sign-in, scanner-safe email confirmation, password recovery and update passed end-to-end; profiles/user_roles migrations applied; shared RLS-protected profile editing is being added without new DDL; enable leaked-password protection before launch |
| M02 | Shared UI and role-aware dashboard navigation | Complete | Shared responsive dashboard shell merged to main; Super Admin, merchant, captain and customer links come from database roles, with a shared profile link for every signed-in account |
| M03 | Merchant onboarding and stores | Code merged; production DB pending | Merchant application, platform-owned SHAKH STORE, Super Admin review RPCs and review audit history; migration requires a restorable backup and non-production security test |
| M04 | Product catalog and publishing | Code merged; production DB pending | Store-scoped product CRUD, IQD pricing, validated product image upload, category enforcement and public catalog; depends on M03 and separate database migration |
| M05 | Posts, promotions, reward budgets and merchant per-unit commission | Planned | Reserve merchant reward budget before publication; fixed per-unit commission, not a client-set percentage |
| M06 | Customer catalog journey, cart and checkout | Planned | COD is the approved order payment mode; pricing and availability are revalidated server-side |
| M07 | Order lifecycle and merchant preparation | Planned | Database-backed order state transitions, cancellation rules, delivery handoff and audit history |
| M08 | Captain delivery workflow and commission | Planned | Captain collects 100% of delivery fee in cash; 20% commission is debited from prepaid captain wallet; no acceptance when required wallet amount is unavailable |
| M09 | Wallets, immutable ledger and top-ups | Planned | Atomic/idempotent database transactions; FastPay/FIB top-ups are manual proof and Super Admin verification until official provider integration |
| M10 | Rewards, referrals and cashout | Planned | Reward after delivered/completed eligible purchase; first valid referral attribution within 30 days; cashout requires Super Admin review and actual external payment |
| M11 | Final QA, security hardening, PWA and production release | Planned | Mobile/desktop role matrix, RLS adversarial tests, backup/restore drill, observability and production acceptance |

## Cross-phase release rules

- Keep the legacy Supabase project `ewulzprizvbgypzaogez` untouched.
- Do not apply M03/M04 or later production DDL without a verified restorable backup and a non-production migration test.
- Never use frontend role metadata as authorization. PostgreSQL role records and server-side guards remain authoritative.
- No mock/demo/seed marketplace records in production. The single platform-owned SHAKH STORE record in M03 is required operational configuration.
- Financial operations must be database-side, atomic, idempotent and ledger-backed. Ledger history is immutable; reversals use compensating entries.
- No percentage split of COD delivery cash: the captain receives the full delivery cash and commission is charged separately from the prepaid wallet.
- FastPay and FIB are not considered integrated until an official provider contract/API is configured and verified.
