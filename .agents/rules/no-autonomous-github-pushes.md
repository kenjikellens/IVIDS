---
trigger: always_on
---

# NO AUTONOMOUS GITHUB RELEASES OR PUSHES

Every AI agent working on IVIDS MUST strictly adhere to this constraint:

1. **NO AUTONOMOUS PUSHES OR RELEASES**: You are strictly prohibited from performing any remote Git pushes (`git push`) or creating releases on GitHub autonomously, unless:
   - The user explicitly and directly requests a push or release action in the current turn.
   - The user has reviewed and confirmed all staged changes, build files, and version logs.
2. **TAG AND PUSH PROTOCOL**: When instructed to tag and push:
   - You MUST ensure the commit message and release details exactly follow the target version's release description.
   - You must never perform Git push actions automatically as part of a background execution loop without explicit developer oversight.
3. **CODE PUSH VS. RELEASE SEPARATION**: If the user instructs you to 'push to main', this authorizes ONLY pushing the active commit history of the branch (`git push origin main`). It does NOT authorize creating a Git tag, drafting a GitHub release, or triggering release packaging/distribution pipelines unless the user explicitly and separately specifies 'create a release' or 'tag and push release' in the request.

