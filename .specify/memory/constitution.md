<!--
SYNC IMPACT REPORT
==================
Version change: [TEMPLATE] → 1.0.0
Bump rationale: MAJOR — first adoption; all placeholder tokens replaced with concrete project values.

Modified principles: N/A (initial authoring from blank template)

Added sections:
  - I. Library-First Architecture
  - II. Test-Driven Development
  - III. Integration Tests Over Mocks
  - IV. Simplicity Over Abstraction
  - V. REST API Design & OpenAPI Documentation
  - VI. TypeScript for Type Safety
  - VII. Minimal Dependencies
  - Technology Standards
  - Development Workflow

Removed sections: N/A

Templates requiring updates:
  - .specify/templates/plan-template.md ✅ (Constitution Check gates are generic and compatible)
  - .specify/templates/spec-template.md ✅ (structure compatible with these principles)
  - .specify/templates/tasks-template.md ✅ (task structure compatible; contract/integration test phases align)
  - .specify/templates/commands/*.md ⚠️ No command templates found — nothing to update

Deferred items:
  - TODO(RATIFICATION_DATE): First formal ratification date unknown; set to project start approximation 2026-06-04
-->

# OctoCAT Supply Chain Constitution

## Core Principles

### I. Library-First Architecture

Every functional capability MUST be implemented as a standalone, independently importable
library module before being wired into a service, API route, or CLI entrypoint.

- Libraries MUST be self-contained: no implicit dependency on framework context or
  global application state.
- Each library MUST be independently testable without starting the full application.
- A library MUST have a clear, single responsibility; no "utility grab-bag" modules.
- New features start as library code; the REST layer is a thin consumer, not the home
  of business logic.

**Rationale**: Decoupling business logic from delivery mechanism (HTTP, CLI, queue)
maximises reuse, enables isolated testing, and prevents framework lock-in.

### II. Test-Driven Development

TDD is NON-NEGOTIABLE. Tests MUST be written and confirmed failing before any
implementation code is written.

- Sequence: write contract/integration test → get user approval → confirm red →
  implement → confirm green → refactor.
- The Red-Green-Refactor cycle MUST be respected; skipping directly to implementation
  is a constitution violation.
- Contract tests for public library APIs MUST precede the library implementation.
- Unit tests MAY be added after implementation for edge-case coverage, but contract
  and integration tests come first.

**Rationale**: Test-first forces explicit agreement on behaviour before code exists,
surfaces design issues early, and guarantees every line of production code is covered
by a failing test that motivated it.

### III. Integration Tests Over Mocks

Integration tests against a real SQLite database are the authoritative test layer for
persistence and data-access logic.

- SQLite MUST be used as the real database in tests; in-memory mocks of the data layer
  are prohibited.
- Contract tests (schema + API shape) MUST use the same SQLite engine as production.
- Mocks are permitted ONLY for external I/O that cannot be run locally (third-party
  HTTP APIs, email gateways, etc.) and MUST be documented in the test file explaining
  why a real integration is not feasible.
- Test fixtures MUST set up and tear down the database to a known state; shared mutable
  state across tests is prohibited.

**Rationale**: Mock-based tests gave false confidence in past incidents where
mock/production divergence masked broken migrations. Real database tests catch schema
drift, constraint violations, and query correctness.

### IV. Simplicity Over Abstraction

Use frameworks and libraries directly; introduce abstractions only when a concrete,
recurring duplication problem exists.

- Repository pattern, service locators, factory hierarchies, and similar structural
  patterns MUST NOT be introduced pre-emptively.
- YAGNI (You Aren't Gonna Need It) is enforced: no code for hypothetical future
  requirements.
- Three similar lines of code is acceptable; extract only when a fourth instance
  appears and the duplication carries genuine maintenance risk.
- Complexity that violates this principle MUST be justified in the plan's Complexity
  Tracking table with a concrete rationale.

**Rationale**: Premature abstraction increases cognitive overhead without delivering
value. Simple, direct code is easier to onboard, debug, and change.

### V. REST API Design & OpenAPI Documentation

All external interfaces MUST be RESTful and documented with OpenAPI.

- HTTP verbs MUST be used semantically: GET (read), POST (create), PUT/PATCH (update),
  DELETE (remove).
- API responses MUST use standard HTTP status codes; no custom error envelopes that
  hide the status.
- Every endpoint MUST be described in an OpenAPI 3.x specification committed to the
  repository.
- Breaking API changes require a version increment in the URL path (e.g., `/v2/`).
- Request and response bodies MUST be validated against the OpenAPI schema at runtime.

**Rationale**: OpenAPI-first design creates a single source of truth for the API
contract shared between backend, consumers, and contract tests.

### VI. TypeScript for Type Safety

All application code MUST be written in TypeScript with strict mode enabled.

- `strict: true` MUST be set in `tsconfig.json`; disabling individual strict flags
  requires documented justification in the PR.
- `any` type is prohibited; use `unknown` with explicit narrowing when the shape is
  genuinely unknown.
- Generated types (e.g., from OpenAPI schemas) MUST be regenerated and committed when
  the source schema changes.
- JavaScript files (`.js`) are permitted only for tooling configuration scripts (e.g.,
  `jest.config.js`, `prettier.config.js`).

**Rationale**: Strict TypeScript catches entire classes of runtime errors at compile
time and serves as executable documentation for data shapes.

### VII. Minimal Dependencies

Every new dependency MUST be evaluated before adoption; the default answer is "no".

- Evaluation criteria: licence compatibility, maintenance activity, bundle size impact,
  security vulnerability history, and whether the need can be met with <50 lines of
  project code instead.
- Dependencies are recorded in `package.json` with a comment in the PR description
  explaining why the dependency was accepted.
- Dev dependencies (test tooling, linters) are exempt from the bundle-size criterion
  but still require licence and maintenance evaluation.
- Peer/transitive dependency counts MUST be checked (`npm ls --depth 0`) before
  acceptance; a new dep that pulls in >10 transitive deps requires explicit approval.

**Rationale**: Each dependency is a future maintenance burden and a potential supply-
chain attack vector. Minimal dependency surface keeps the project auditable and lean.

## Technology Standards

- **Language**: TypeScript (Node.js runtime)
- **Database**: SQLite (via a lightweight driver; no ORM)
- **API Framework**: Direct use of a minimal HTTP framework (e.g., Fastify or Express)
  without abstraction layers
- **OpenAPI**: Spec-first (`openapi.yaml` committed; runtime validation enforced)
- **Test Runner**: Vitest or Jest (single runner, not both)
- **Linter / Formatter**: ESLint + Prettier with project-wide config

## Development Workflow

1. For each feature: run `/speckit-specify` → `/speckit-clarify` → `/speckit-plan` →
   `/speckit-tasks` → `/speckit-implement`.
2. Contract tests MUST be written (and confirmed failing) before implementation tasks
   begin (see Principle II).
3. All PRs MUST include a Constitution Check confirming no principle violations, or a
   documented exception in the Complexity Tracking table.
4. Database migrations MUST be tested with a fresh SQLite database in CI; no
   migration is merged without an integration test.
5. OpenAPI spec MUST be updated in the same PR as any API surface change.

## Governance

This constitution supersedes all other practices, conventions, and verbal agreements.
Amendments require:

1. A written proposal describing the change, the motivation, and a migration plan for
   existing code affected by the change.
2. Documented approval (PR review or explicit acknowledgement by project leads).
3. A version bump following semantic versioning rules (MAJOR/MINOR/PATCH as defined
   below) committed alongside the updated constitution.
4. Propagation: all dependent templates (plan, spec, tasks) MUST be reviewed and
   updated in the same PR if the amendment affects their gates or sections.

**Versioning policy**:
- MAJOR: backward-incompatible governance change; principle removed or fundamentally
  redefined in a way that invalidates prior decisions.
- MINOR: new principle or section added; materially expanded guidance.
- PATCH: clarifications, wording, typo fixes, non-semantic refinements.

**Compliance review**: Every feature plan MUST include a Constitution Check gate.
Violations not listed in the Complexity Tracking table are grounds for blocking merge.

**Version**: 1.0.0 | **Ratified**: 2026-06-04 | **Last Amended**: 2026-06-04
