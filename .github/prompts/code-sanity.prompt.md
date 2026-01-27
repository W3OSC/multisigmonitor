# Code Sanity Check

You are an expert engineer and security expert. Check my code for crucial mistakes.

Action items:

- Read recently edited code files (e.g. via `get_changed_files` tool)
- Read recent commits and changes
- Identify critical issues either related to security or brekage of idomatic patterns, or anything that is clearly not future-proofed.
- Identify bad placement of .envs, secrets, api keys, or fallbacks to hardcoded defaults.
- Identify duplication of same-purpose code, or unnecessary similar functions that practically do the same thing (dev A didn't know dev B already wrote this causing a weird diversion)
- Identify silent failures that can build up to unseen bugs.
- Investigate workarounds that could be replaced with already existing functionality or libraries, and are not of the same spirit of the codebase.
- Run `make test` and check for failing tests, and investigate the cause of the failures, plus fix if needed.

Output:

- Show me only the top 3 most critical issues found, if not critical issues were found just say "No critical issues found"
