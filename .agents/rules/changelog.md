---
trigger: always_on
---

# [MANDATORY] CHANGELOG PROTOCOL
Every single file modification (create, edit, or delete) MUST be logged in CHANGELOG.md. NOT GITHUB PULLS or PUSHES!

1. **TRIGGER**: This is a post-task requirement. After editing all the files for a task, you must update the changelog before ending your turn or responding to the user.
2. **GRANULARITY**: You must add exactly one line for every file changed. Do not group multiple files into one line.
3. **FORMAT BINDING**: Every entry must follow this exact template: 
   `[HH:mm DD-MM-YYYY] filenames.ext - concise description of the specific change.`
4. **STRICT SEQUENCE**: 
   - Step A: Complete all file modifications for the task.
   - Step B: Verify the edits were successful.
   - Step C: Update CHANGELOG.md with entries for all changed files.
   - Step D: Proceed to respond to the user.
5. **SYNC REQUIREMENT**: If the user has a Git repository, the changelog update must be included in the commit/push.
6. **CLEARING PROTOCOL**: The CHANGELOG.md must be cleared (emptied) when the user explicitly instructs to 'make a release' (or 'create a release', 'tag and push release'). It must NOT be cleared when pushing to main.

FAILURE TO UPDATE THE CHANGELOG IS CONSIDERED AN OPERATIONAL ERROR.