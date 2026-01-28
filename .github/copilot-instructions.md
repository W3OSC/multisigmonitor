## Contribution guidelines

- Don't create temporary files like `/tmp` files, 1-time scripts, etc.
- Emoji's are not allowed anywhere in the code
- Don't use comments in the code, good code is self-explanatory
- Don't use echo statements to state instructions that you were tasked to implement
- Always follow the coding style and patterns already established in the codebase
- Always store passwords or secrets in `../secrets/.env.x.local` and never hardcode them in the code
- Code should not compile if ENVs are missing
- Future proofing is a requirement for every feature added or modified
- It's imperative that during development and testing a future proof mindset will be applied. Hackish workarounds that won't solve the problem a few steps down the line are not acceptable
- Never write direct shell commands through code
- A task is not considered successful if it relied on manual steps, workarounds, or temporary fixes
- Remaking a file from scratch, when the file is already present, is not acceptable
- If you fixed an issue you are certain is prone to reoccur, fix it at the root cause and create a test for it
- Mobile responsiveness is required for every UI change
- Accessibility compliance is required for every UI change
- SEO excellence is required for every UI change (use react appropriate react library)
- Always prefer using existing libraries and utilities already present in the codebase
- Security best practices must be followed at all times
- APIs used by users must be equivalently operatable via user-generated API key (not just normal auth)
- Never call alert/message box and always use a stylish modal component, with consistent UX and tab navigation
- Don't use unwrap_or or similar that can hide potential issues, always handle errors explicitly

## AGENTS instructions

- Use the above contribution guidelines when making code changes
- Attempt to understand how to interact with the system, and after you apply code changes, verify the changes work as intended (e.g. running tests, reading logs, curl commands, etc)
- If you are unsure about how to proceed with a code change, ask for clarification
- Never use fallbacks or workarounds for task completion
- Never use mock data or mock implementations for task completion
- Never create a new function over fixing or updating an existing one
- Don't stdout to 2>&1 or similar
- Building is only for production or production-preparations, otherwise always use pm2 to run debug and inspect the code