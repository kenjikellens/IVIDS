---
trigger: always_on
---

# [MANDATORY] CHANGELOG PROTOCOL
Every single file modification (create, edit, or delete) MUST be logged in CHANGELOG.md. 

1. **TRIGGER**: This is not a task-end requirement; it is a "Post-Edit Hook." As soon as a file is successfully modified, your VERY NEXT action must be to update the changelog.
2. **GRANULARITY**: You must add exactly one line for every file changed. Do not group multiple files into one line.
3. **FORMAT BINDING**: Every entry must follow this exact template: 
   `[HH:mm DD-MM-YYYY] filenames.ext - concise description of the specific change.`
4. **STRICT SEQUENCE**: 
   - Step A: Verify the edit was successful.
   - Step B: IMMEDIATELY update CHANGELOG.md.
   - Step C: Only then proceed to the next file or respond to the user.
5. **SYNC REQUIREMENT**: If the user has a Git repository, the changelog update must be included in the commit/push.

FAILURE TO UPDATE THE CHANGELOG IS CONSIDERED AN OPERATIONAL ERROR.