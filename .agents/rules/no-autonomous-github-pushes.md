---
trigger: always_on
---

# GITHUB PUSH & RELEASE RULES

Every AI agent working on IVIDS MUST strictly adhere to these constraints:

1. **NO AUTONOMOUS PUSHES TO MAIN**: You are strictly prohibited from performing Git commits (`git commit`) or remote Git pushes (`git push`) for standard code or document edits autonomously. All standard edits must remain in the working tree so the user can review them. You MUST wait for the user to say 'push to main' or something alike before running the commit and push commands for standard branch updates.
   - **SINGLE-TURN AUTHORIZATION**: Authorization to commit and push applies ONLY to the active changes discussed in that specific turn.

2. **AUTONOMOUS RELEASE EXECUTION (THE EXCEPTION)**: If the user explicitly asks for a **release** (e.g., via the `/version-and-release-update` workflow, or saying "make a release v0.4.1"), you **MUST autonomously perform the entire release process**, including creating the local release commit, creating the tag, pushing ONLY the tag to GitHub, and drafting the GitHub release. You are strictly PROHIBITED from pushing the release commit directly to the `main` branch autonomously. The `main` branch update must remain local until explicitly authorized.

3. **CODE PUSH VS. RELEASE SEPARATION**: If the user only instructs you to 'push to main', this authorizes ONLY pushing the active commit history of the branch. It does NOT authorize creating a Git tag or drafting a GitHub release.

4. **MANDATORY BUILD BEFORE PUSH OR RELEASE**: Before executing ANY `git push` to `main` or creating a release, you MUST first run `.\build.bat` (or `.\build.bat release` for production releases) in the workspace root to compile the latest APK and EXE binaries. Pushing without building first is strictly PROHIBITED.