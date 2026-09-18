---
name: firefox
description: >-
  Comprehensive Mozilla & Firefox RelOps, CI, infrastructure, and telemetry engineering toolkit.
  Consolidates 7 modules: Firefox CI test coverage by platform, production worker image deployment,
  Taskcluster queue diagnosis, Taskcluster worker lifecycle logs, Mozilla Redash telemetry queries,
  Azure CI cost analysis, and Azure support ticket management.
  Triggers on "firefox", "mozilla", "taskcluster", "fxci", "redash telemetry", "worker pool",
  "firefox ci", "production image deploy", or Mozilla CI/infrastructure tasks.
---

# Firefox & Mozilla RelOps Engineering Suite

Unified toolkit for Mozilla RelOps, Firefox CI, infrastructure management, telemetry, and Taskcluster operations.

## Overview of Modules

| Module | Description | Documentation |
|---|---|---|
| **`firefox-ci-test-coverage-by-platform`** | Query Firefox CI test health by platform: tier classification, skip rates, coverage gaps, pool comparisons, and suite analysis. | [`modules/firefox-ci-test-coverage-by-platform/`](modules/firefox-ci-test-coverage-by-platform/SKILL.md) |
| **`production-image-deploy`** | End-to-end promotion of worker images in Firefox CI (build trigger, verify artifact, bump `worker-images.yml`, rollout PR, Bugzilla). | [`modules/production-image-deploy/`](modules/production-image-deploy/SKILL.md) |
| **`queue-diagnosis`** | Diagnose Taskcluster worker-pool backlog combining real-time pool status with BigQuery/Redash demand analysis. | [`modules/queue-diagnosis/`](modules/queue-diagnosis/SKILL.md) |
| **`taskcluster-worker-lifecycle-logs`** | Investigate Taskcluster worker provisioning, registration, Azure scanner health, and VM traces via `tc-logview`. | [`modules/taskcluster-worker-lifecycle-logs/`](modules/taskcluster-worker-lifecycle-logs/SKILL.md) |
| **`redash`** | Query Mozilla's Redash (`sql.telemetry.mozilla.org`) for Firefox user telemetry, OS distribution, and FXCI task data. | [`modules/redash/`](modules/redash/SKILL.md) |
| **`azure-cost-analysis`** | Analyze FXCI Azure CI costs across 3 subscriptions (FXCI DevTest, Trusted FXCI, TC Engineering). | [`modules/azure-cost-analysis/`](modules/azure-cost-analysis/SKILL.md) |
| **`azure-support-ticket`** | File and manage Azure support tickets (quota increases, Sev changes) via CLI for FXCI subscriptions. | [`modules/azure-support-ticket/`](modules/azure-support-ticket/SKILL.md) |

---

## 1. Firefox CI Test Coverage

Query test health and tier coverage from pre-computed snapshots.

```bash
# Basic platform & test suite queries
python3 modules/firefox-ci-test-coverage-by-platform/scripts/query.py summary
python3 modules/firefox-ci-test-coverage-by-platform/scripts/query.py platform windows11
python3 modules/firefox-ci-test-coverage-by-platform/scripts/query.py suite xpcshell
python3 modules/firefox-ci-test-coverage-by-platform/scripts/query.py os linux
python3 modules/firefox-ci-test-coverage-by-platform/scripts/query.py risk
python3 modules/firefox-ci-test-coverage-by-platform/scripts/query.py compare <pool1> <pool2>
```

- **Snapshots & Assets:** [`modules/firefox-ci-test-coverage-by-platform/assets/`](modules/firefox-ci-test-coverage-by-platform/assets/)
- **Documentation:** [`modules/firefox-ci-test-coverage-by-platform/SKILL.md`](modules/firefox-ci-test-coverage-by-platform/SKILL.md)

---

## 2. Production Worker Image Deployment

Promoting new worker images into Firefox CI:
1. Trigger Action build in `mozilla-platform-ops/worker-images`
2. Verify published artifacts
3. Bump `worker-images.yml` in `mozilla-releng/fxci-config`
4. PR validation (`/taskcluster integration`)
5. Post-merge health checks and Bugzilla recording

- **Detailed Runbook:** [`modules/production-image-deploy/SKILL.md`](modules/production-image-deploy/SKILL.md)
- **Reference Docs:** [`modules/production-image-deploy/references/`](modules/production-image-deploy/references/)

---

## 3. Taskcluster Queue Diagnosis

Run real-time diagnostics on worker pools:

```bash
uv run modules/queue-diagnosis/scripts/diagnose.py <pool-id>
# Example:
uv run modules/queue-diagnosis/scripts/diagnose.py gecko-t/win11-64-25h2
```

Classifies queue state into: `supply-side`, `demand-side`, `mixed`, `recently-impacted`, or `no-active-backlog`.

- **Documentation:** [`modules/queue-diagnosis/SKILL.md`](modules/queue-diagnosis/SKILL.md)
- **Query References:** [`modules/queue-diagnosis/references/queries.md`](modules/queue-diagnosis/references/queries.md)

---

## 4. Taskcluster Worker Lifecycle Logs

Query worker-manager and worker-scanner events with `tc-logview`:

```bash
tc-logview list --service worker-manager
tc-logview query -e fx-ci --type worker-removed --where 'workerPoolId=gecko-t/win11-64-25h2' --since 24h --json
```

- **Documentation:** [`modules/taskcluster-worker-lifecycle-logs/SKILL.md`](modules/taskcluster-worker-lifecycle-logs/SKILL.md)
- **Log Schema:** [`modules/taskcluster-worker-lifecycle-logs/references/log-schema.md`](modules/taskcluster-worker-lifecycle-logs/references/log-schema.md)

---

## 5. Mozilla Redash & BigQuery Telemetry

Query telemetry and CI data from `sql.telemetry.mozilla.org`:

```bash
# Execute SQL
uv run modules/redash/scripts/query_redash.py --sql "SELECT * FROM telemetry.main LIMIT 10"

# Fetch cached results by Query ID
uv run modules/redash/scripts/query_redash.py --query-id 114866
```

- **Prerequisites:** `REDASH_API_KEY` set in environment.
- **Documentation:** [`modules/redash/SKILL.md`](modules/redash/SKILL.md)
- **Common Queries:** [`modules/redash/references/common-queries.md`](modules/redash/references/common-queries.md)

---

## 6. Azure Cost Analysis (FXCI)

Analyze Azure CI spend across subscriptions:

```bash
uv run modules/azure-cost-analysis/scripts/query_costs.py ...
uv run modules/azure-cost-analysis/scripts/count_push_tasks.py ...
```

- **Documentation:** [`modules/azure-cost-analysis/SKILL.md`](modules/azure-cost-analysis/SKILL.md)
- **Methodology & Dimensions:** [`modules/azure-cost-analysis/references/`](modules/azure-cost-analysis/references/)

---

## 7. Azure Support Tickets

File and manage support tickets for quota bumps:

```bash
uv run modules/azure-support-ticket/scripts/file_ticket.py quota \
  --region southcentralus \
  --quota-type LowPriorityCores \
  --new-limit 4000 \
  --severity moderate \
  --reason "eastus2 has 20%+ Spot eviction on Standard_D32ads_v5"
```

- **Documentation:** [`modules/azure-support-ticket/SKILL.md`](modules/azure-support-ticket/SKILL.md)
- **Quota Recipes:** [`modules/azure-support-ticket/references/quota-recipes.md`](modules/azure-support-ticket/references/quota-recipes.md)
