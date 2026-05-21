# Skill Registry — AurumIQ

> **Purpose:** Persistent skill inventory. Claude MUST scan this list before starting ANY task.
> **Protocol:** Match task to skill(s) first. Only work without a skill if no match exists.
> **Maintenance:** When a new skill is created via `skill-creator`, add it here immediately.

## Decision Flow

```
1. RECEIVE TASK from user
2. SCAN this registry → match task to skill(s)
   ├─ MATCH FOUND → Invoke skill via Skill tool, follow its process
   ├─ NO MATCH → Can the task be done without a skill?
   │   ├─ YES → Execute directly
   │   └─ NO → Use skill-creator:skill-creator to build one
   │           → Add new skill to this registry
   └─ MULTIPLE MATCHES → Priority order:
       1. Process skills first (brainstorming, debugging, planning)
       2. Implementation skills second (frontend-design, TDD, execute)
```

---

## Superpowers (Core Workflow)

| Skill | When to Use |
|---|---|
| `superpowers:brainstorming` | Before any creative, design, or planning work |
| `superpowers:writing-plans` | Have a spec, need an implementation plan |
| `superpowers:executing-plans` | Have a written plan to execute |
| `superpowers:test-driven-development` | Implementing any feature or fix |
| `superpowers:systematic-debugging` | Any bug, test failure, or unexpected behavior |
| `superpowers:subagent-driven-development` | Executing implementation plans with subagents |
| `superpowers:dispatching-parallel-agents` | 2+ independent tasks to run simultaneously |
| `superpowers:requesting-code-review` | Completing a task or implementation |
| `superpowers:receiving-code-review` | Received code review feedback to address |
| `superpowers:verification-before-completion` | About to claim work is done |
| `superpowers:finishing-a-development-branch` | Implementation complete, preparing branch |
| `superpowers:using-git-worktrees` | Starting feature work that needs isolation |
| `superpowers:using-superpowers` | Session startup — skill discovery |
| `superpowers:writing-skills` | Creating or editing skills |

## GSD (Project Management & Execution)

| Skill | When to Use |
|---|---|
| `gsd-new-project` | Initialize new project with deep research |
| `gsd-new-milestone` | Start a new milestone cycle |
| `gsd-plan-phase` | Create detailed phase plan (PLAN.md) |
| `gsd-execute-phase` | Execute plans with atomic commits |
| `gsd-discuss-phase` | Gather phase context through discussion |
| `gsd-spec-phase` | Clarify WHAT a phase delivers |
| `gsd-mvp-phase` | Plan a phase as vertical MVP slice |
| `gsd-verify-work` | Validate built features |
| `gsd-validate-phase` | Audit and fill Nyquist validation gaps |
| `gsd-quick` | Small fixes, doc updates, ad-hoc tasks |
| `gsd-fast` | Execute trivial task inline |
| `gsd-debug` | Systematic debugging with persistence |
| `gsd-autonomous` | Run all remaining phases autonomously |
| `gsd-code-review` | Review source files for quality |
| `gsd-audit-fix` | Autonomous audit-to-fix pipeline |
| `gsd-audit-milestone` | Audit milestone against objectives |
| `gsd-audit-uat` | Cross-phase audit of UAT items |
| `gsd-secure-phase` | Verify threat mitigations in code |
| `gsd-ui-phase` | Generate UI design contract (UI-SPEC.md) |
| `gsd-ui-review` | 6-pillar visual audit of frontend |
| `gsd-ai-integration-phase` | Generate AI-SPEC.md design contract |
| `gsd-eval-review` | Audit AI evaluation coverage |
| `gsd-ship` | Create PR, run review, prepare for merge |
| `gsd-pr-branch` | Create clean PR branch |
| `gsd-docs-update` | Generate/update project documentation |
| `gsd-ingest-docs` | Bootstrap/merge .planning/ setup |
| `gsd-import` | Ingest external plans with conflict resolution |
| `gsd-map-codebase` | Analyze codebase with parallel mappers |
| `gsd-stats` | Display project statistics |
| `gsd-health` | Diagnose planning directory health |
| `gsd-progress` | Check progress, advance workflow |
| `gsd-phase` | CRUD for phases in ROADMAP.md |
| `gsd-manager` | Interactive command center |
| `gsd-resume-work` | Resume from previous session |
| `gsd-pause-work` | Create context handoff when pausing |
| `gsd-capture` | Capture ideas, tasks, notes |
| `gsd-explore` | Socratic ideation and routing |
| `gsd-spike` | Spike an idea through experimentation |
| `gsd-sketch` | Sketch UI/design ideas |
| `gsd-thread` | Manage persistent context threads |
| `gsd-workstreams` | Manage parallel workstreams |
| `gsd-workspace` | Manage GSD workspaces |
| `gsd-inbox` | Triage GitHub issues |
| `gsd-review` | Cross-AI peer review |
| `gsd-review-backlog` | Review and promote backlog items |
| `gsd-plan-review-convergence` | Cross-AI plan convergence loop |
| `gsd-ultraplan-phase` | Offload plan to Claude (beta) |
| `gsd-forensics` | Post-mortem for failed phases |
| `gsd-extract-learnings` | Extract decisions, lessons, patterns |
| `gsd-cleanup` | Archive accumulated phase dirs |
| `gsd-complete-milestone` | Archive completed milestone |
| `gsd-milestone-summary` | Generate project summary |
| `gsd-undo` | Safe git revert |
| `gsd-add-tests` | Generate tests for completed phase |
| `gsd-graphify` | Build/query project knowledge graph |
| `gsd-profile-user` | Generate developer behavioral profile |
| `gsd-config` | Configure GSD settings |
| `gsd-settings` | Configure workflow toggles |
| `gsd-update` | Update GSD to latest |
| `gsd-surface` | Toggle which skills are surfaced |
| `gsd-help` | Show available GSD commands |

## GSD Namespace Shortcuts

| Skill | Maps To |
|---|---|
| `gsd-ns-context` | Codebase intelligence (map, graphify) |
| `gsd-ns-ideate` | Exploration (explore, sketch, capture) |
| `gsd-ns-manage` | Config, workspace, workstreams, threads |
| `gsd-ns-project` | Project lifecycle (milestones, audit) |
| `gsd-ns-review` | Quality gates (code review, debug, audit) |
| `gsd-ns-workflow` | Workflow (discuss, plan, execute, verify) |

## Claude-Mem (Persistent Memory)

| Skill | When to Use |
|---|---|
| `claude-mem:how-it-works` | Explain memory capture system |
| `claude-mem:do` | Execute a phased implementation plan |
| `claude-mem:knowledge-agent` | Build/query AI knowledge agents |
| `claude-mem:babysit` | Watch a PR or review cycle |
| `claude-mem:learn-codebase` | Prime entire codebase into memory |
| `claude-mem:pathfinder` | Map codebase into feature groups |
| `claude-mem:smart-explore` | Token-optimized structural code search |
| `claude-mem:mem-search` | Search persistent cross-session memory |
| `claude-mem:timeline-report` | Generate project journey report |
| `claude-mem:make-plan` | Create detailed phased plan |
| `claude-mem:version-bump` | Automated semantic versioning |
| `claude-mem:wowerpoint` | Turn doc into kawaii Notepad slides |

## Context-Mode (Context Window Management)

| Skill | When to Use |
|---|---|
| `context-mode:context-mode` | Use ctx tools for analysis/processing |
| `context-mode:context-mode-ops` | Manage GitHub issues, PRs via context-mode |
| `context-mode:ctx-doctor` | Run diagnostics on context-mode |
| `context-mode:ctx-insight` | Open analytics dashboard |
| `context-mode:ctx-purge` | Purge knowledge base |
| `context-mode:ctx-upgrade` | Update context-mode from GitHub |
| `context-mode:ctx-stats` | Show context window savings |
| `context-mode:diagnose` | Disciplined diagnosis loop for hard bugs |
| `context-mode:grill-me` | Interview user relentlessly about requirements |
| `context-mode:grill-with-docs` | Challenge with documentation |
| `context-mode:tdd` | Test-driven development (red-green-refactor) |
| `context-mode:improve-codebase-architecture` | Find deepening opportunities in codebase |

## Design & Frontend

| Skill | When to Use |
|---|---|
| `frontend-design:frontend-design` | Create production-grade, distinctive UI designs |

## Domain-Specific

| Skill | When to Use |
|---|---|
| `claude-api` | Build/debug Claude API or Anthropic SDK apps |
| `fastapi-python` | FastAPI Python development |

## Meta / Utility

| Skill | When to Use |
|---|---|
| `simplify` | Review changed code for reuse, quality, efficiency |
| `loop` | Run prompt or slash command on recurring interval |
| `schedule` | Create/manage scheduled remote agents (cron) |
| `update-config` | Configure Claude Code settings.json |
| `keybindings-help` | Customize keyboard shortcuts |
| `find-skills` | Discover and install new skills |
| `skill-creator:skill-creator` | Create new skills — ADD NEW SKILLS TO THIS FILE |

---

## Custom Skills (Created During Project)

_None yet. Add entries here when skills are created via `skill-creator:skill-creator`._
