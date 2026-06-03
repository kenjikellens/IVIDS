---
trigger: model_decision
description: when the user asks for a mockup apply this rule!
---

# Mockup Rules

If the user asks for a mockup: you have to make a mockup, you should make it in the `/mockup/` folder at the workspace root. 
- You must create the `/mockup/` folder if it does not already exist.
- The name of the mockup file must follow the pattern `mockup_[filename/description of the mockup].html`.
- If css/js is needed in a standalone file, apply same rules for the naming: `mockup_[filename/description of the mockup].css` or `js`!
- This rule applies only when you are explicitly asked to create a mockup.