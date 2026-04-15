---
name: todo
description: "Add, list, or manage parking lot items for later. Usage: /sno:todo [item to add]"
argument-hint: "item to add (optional)"
---

You manage the sno todo list. Todos prefer **beads** when available, fall back to **GitHub issues**, then to a local file.

## Step 1: Detect backend

Try in order — use the first one that succeeds:

1. **Beads**: run `bd status 2>/dev/null` (or check for `.beads/` directory). If the project has beads initialized, use **beads mode**.
2. **GitHub**: run `gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null`. If it succeeds, use **GitHub mode**.
3. **Local**: otherwise use **local mode**.

Never ask the user which mode to use — just detect and go.

---

## Beads mode (preferred)

**If the user provides an item:**
1. Create a todo with `bd todo add "<item>"` (this creates a task-type issue at priority 2 with the `todo` convention).
2. Tag it with `sno:todo` so it's distinguishable: `bd tag <id> sno:todo` (create the label first if needed via `bd label create sno:todo` — check `bd label --help` for exact syntax).
3. Confirm with the issue ID: "Created <id>: <title>"

**If no item is provided:**
1. List open sno todos: `bd list --label sno:todo --status open` (or `bd todo list` if the user only uses beads for sno todos).
2. If none exist, say "Todo list is empty."
3. Display the list.
4. Ask the user what they want to do:
   - Add an item (`bd todo add "<item>"`)
   - Close an item (`bd close <id>` or `bd todo done <id>`)
   - Promote an item to a new sno cycle (start `/sno:learn` with the issue as context, then close it)

---

## GitHub mode

**If the user provides an item:**
1. Create a GitHub issue via `gh issue create --title "<item>" --label "sno:todo"`.
   - If the `sno:todo` label doesn't exist, create it first: `gh label create "sno:todo" --description "Parking lot item from sno" --color "c5def5"`.
2. Confirm with the issue URL: "Created issue #N: <title>"

**If no item is provided:**
1. List open issues with the `sno:todo` label: `gh issue list --label "sno:todo" --state open`
2. If none exist, say "Todo list is empty."
3. Display the list.
4. Ask the user what they want to do:
   - Add an item (create a new issue)
   - Close an item (`gh issue close <number>`)
   - Promote an item to a new sno cycle (start `/sno:learn` with the issue as context, then close it)

---

## Local mode (fallback)

**If the user provides an item:**
1. Create `.sno/` and `.sno/todos.md` if they don't exist.
2. Append the item as a checkbox line: `- [ ] <item>`
3. Confirm: "Added to todo list. You have N items."

**If no item is provided:**
1. Read `.sno/todos.md`. If it doesn't exist or is empty, say "Todo list is empty."
2. Display the list.
3. Ask the user what they want to do:
   - Add an item
   - Remove/complete an item (mark with `[x]` or delete)
   - Promote an item to a new sno cycle (start `/sno:learn` with it as context)

### Local file format

```markdown
# Todo

- [ ] Item one
- [ ] Item two
- [x] Completed item
```

---

## Rules
- Keep it simple. This is a parking lot, not a project management tool.
- Items should be short — one line each.
- Don't auto-organize, categorize, or prioritize unless asked.
- Backend preference is always **beads → GitHub → local**. Never ask the user which mode to use — just detect and go.
- When creating issues, keep the title concise. If the user provides extra context, put it in the issue body (`--description` for beads, `--body` for gh).
