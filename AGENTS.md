# AI Agent Instructions

## Source of Truth

This project uses the `.agent` directory as the single source of truth for all AI agents.

When working with this repository you MUST:

1. Always look for the `.agent` directory before making changes.
2. Read all relevant files from `.agent/rules/`.
3. Use skills from `.agent/skills/` whenever applicable.
4. Use prompts from `.agent/prompts/`.
5. Use MCP configurations from `.agent/mcp/`.
6. Never create duplicate instructions in `.cursor`, `.claude`, `.roo`, `.windsurf`, etc.
7. If a tool requires its own configuration directory, it should only contain a reference to `.agent`, not duplicated content.

If `.agent` exists, it always overrides any default behavior.
