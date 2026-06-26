# .claude/rules/ — path-scoped rules

Rules here load **only when Claude opens a file matching the `paths:` globs** in the rule's frontmatter — so the always-loaded `CLAUDE.md` stays lean while domain guidance arrives exactly when it's needed.

**Frontmatter:** a YAML `paths:` list of glob patterns (literal globbing — use `**` for nested). Omit `paths:` to load a rule unconditionally at startup (like `CLAUDE.md`). Only the `paths:` key is recognized; other keys are ignored.

**One fact, one home:** a rule here is the canonical place for its domain — `CLAUDE.md` points to it rather than restating the detail.

## Current rules
| File | Loads when you open… |
|---|---|
| `quote-builders.md` | the 4 quote builders + shared builder JS/CSS/invoice file |
| `pricing-services.md` | any `shared_components/js/*-pricing-service.js` |

Full memory architecture → [`memory/MEMORY_SYSTEM.md`](../../memory/MEMORY_SYSTEM.md).
