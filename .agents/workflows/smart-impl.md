---
description: Standardized protocol for smart, verified implementations with planning, execution, Critic scoring out of 20, and conditional iterative refinement loop.
---

# Smart Implementation Workflow (`/smart-impl`)

See the primary skill definition in [.agents/skills/smart-impl/SKILL.md](../skills/smart-impl/SKILL.md).

## Protocol Summary
1. **Initialize `task.md` Overview**: Starts strictly with Steps 1, 2, and 3 only (Step 4 is never written initially).
2. **Phase 1: Planning**: Create `implementation_plan.md` with OOP architecture and Mermaid class/sequence diagrams.
3. **Phase 2: Execution**: Execute code changes directly (upon confirmation if requested by user) and validate syntax.
4. **Phase 3: Critic Review**: Spawn Critic subagent evaluating 5 categories for a total score out of 20 against the user's required threshold (default: 18/20).
5. **Phase 4: Conditional Refinement Loop (Only if score < target)**:
   - Dynamically append `4a. Refining` and `4a-1. Reviewing` to `task.md`.
   - Fix failed points, re-review, and continue (`4b`, `4b-1`...) iteratively until target is reached.
