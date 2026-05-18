---
trigger: always_on
---

# NO AUTONOMOUS GITHUB RELEASES OR PUSHES

Every AI agent working on IVIDS MUST strictly adhere to this constraint:

1. **NO AUTONOMOUS COMMITS OR PUSHES**: You are strictly prohibited from performing any Git commits (`git commit`) or remote Git pushes (`git push`) autonomously. All edits must remain in the working tree (as modified or staged files showing the yellow 'M' or green indicators in the IDE) so the user can easily review the changes. You are ONLY authorized to stage (`git add`) files to organize edits, but you MUST wait for the user to explicitly say 'push to main' before running the commit and push commands in a single, combined sequence.
   - **SINGLE-TURN AUTHORIZATION**: Authorization to commit and push applies ONLY to the active changes discussed in that specific turn. If you make any subsequent or additional edits in a later turn, you MUST obtain fresh, explicit authorization before performing another commit and push. You can never assume previous push authorization extends to new edits.


2. **TAG AND PUSH PROTOCOL**: When instructed to tag and push:
   - You MUST ensure the commit message and release details exactly follow the target version's release description.
   - You must never perform Git push actions automatically as part of a background execution loop without explicit developer oversight.
3. **CODE PUSH VS. RELEASE SEPARATION**: If the user instructs you to 'push to main', this authorizes ONLY pushing the active commit history of the branch (`git push origin main`). It does NOT authorize creating a Git tag, drafting a GitHub release, or triggering release packaging/distribution pipelines unless the user explicitly and separately specifies 'create a release' or 'tag and push release' in the request.

