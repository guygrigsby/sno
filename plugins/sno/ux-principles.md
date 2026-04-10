# UX Principles

Canonical UX principles for sno's UX-aware agents (`ux-reviewer`, `accessibility-auditor`, `pr-reviewer`, `critical-reviewer`, `planner`, `requirements-interviewer`). This file is the single source of truth; agents cite principles here by identifier (e.g. `UX-P1b`) and inline only a one-line summary in their own prompts. Each principle is drawn from industry-leading design authorities (Apple HIG, Nielsen Norman Group, Material Design 3, Stripe, Linear, Refactoring UI, Shneiderman 1983, WCAG 2.1).

## Maintenance

This file is versioned with the rest of the sno plugin. Changes to principle content, severity, or applicability are proposed via a normal sno cycle (learn, plan, build, check, ship). The file is small and stable by design.

**Severity-revision procedure.** A principle's severity may flip between `should-have` and `must-have` only when two conditions are met:

1. A concrete, mechanical `how_to_check` procedure exists that two independent reviewers would apply identically. Judgment-heavy principles stay `should-have`; only mechanically checkable ones may be promoted to `must-have`.
2. The plugin owner (Guy J Grigsby, or a successor maintainer) explicitly approves the flip in the spec for that cycle. A severity flip is never a drive-by edit — it is always a spec-level decision with a Decisions Log entry.

Demotion from `must-have` to `should-have` follows the same procedure: a reviewer flags that the `how_to_check` has become judgment-heavy in practice (too many false positives), the owner confirms, the flip lands with a Decisions Log entry.

**ID-enumeration invariant.** The principle ID set is fixed. The valid IDs are UX-P1a through UX-P13, specifically: `UX-P1a`, `UX-P1b`, `UX-P2`, `UX-P3`, `UX-P4`, `UX-P5`, `UX-P6`, `UX-P7`, `UX-P8`, `UX-P9`, `UX-P10`, `UX-P11`, `UX-P12`, `UX-P13`. No principle IDs exist above UX-P13 or below UX-P1a, and no ID above UX-P13 may be introduced without a spec-level decision to expand the set. Any deviation (a stray `UX-P14`, a `UX-P0`, a `UX-P2b` without a prior spec decision) is a bug, not a new principle. Reviewers and agents must treat unrecognized IDs as errors and refuse to cite them.

## Headline Principle

### Headline: Keyboard continuity for repetitive flows (UX-P1b) {#ux-p1b}

Keyboard continuity for repetitive flows is sno's headline UX principle. The user's working hands rarely leave the keyboard during any frequently repeated task, and every forced mouse-reach during a repetitive flow is a measurable per-interaction cost that compounds. This principle is listed first in the file because it outranks the twelve general principles below in any conflict — if a design satisfies progressive disclosure or direct manipulation but forces a mouse-reach during a repetitive flow, it fails.

The headline principle is reviewed as `UX-P1b` with `severity: must-have` and `applies_in_phase: [plan, check]`. It applies to `[gui, mobile, tui]` surfaces and is reviewed in both plan and check phases of every cycle whose target has one of those surfaces.

Rationale. In flows performed more than occasionally, forced mouse-reaches are a measurable per-interaction cost and accumulate into serious friction, defeating fluency for the users who use the product most.

How to check. For each repetitive flow in the spec or diff, walk through it keyboard-only. Every interactive element must be reachable via Tab (or a named shortcut); tab order must match visual and DOM order; common actions must have documented keyboard shortcuts; keyboard-native inputs are preferred over custom widgets; modals must be Esc-dismissible; autocomplete must not hijack Enter submission. Focus can leave every interactive region via keyboard — no traps, no loops (WCAG 2.1.2 No Keyboard Trap). Every focusable element has a visible focus indicator, and the indicator meets 3:1 contrast against its background (WCAG 2.4.7 Focus Visible).

Counter-example. A multi-field data-entry form where Tab skips a custom combobox and forces the user to click it with a mouse.

Positive example. Linear's command palette (Cmd+K) and inline shortcuts — every action has a keyboard path, and the palette itself is discoverable.

Sources.

1. [Linear — How we redesigned the Linear UI (Part II)](https://linear.app/now/how-we-redesigned-the-linear-ui) — archived snapshot: <https://web.archive.org/web/2026/https://linear.app/now/how-we-redesigned-the-linear-ui>
2. [Stripe — Payment HTML forms: Best practices for conversion](https://stripe.com/resources/more/payment-html-forms) — archived snapshot: <https://web.archive.org/web/2026/https://stripe.com/resources/more/payment-html-forms>
3. [W3C WCAG 2.1.1 Keyboard (Level A)](https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html) — archived snapshot: <https://web.archive.org/web/2026/https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html>

## Principles

The twelve general principles below apply alongside the headline. They are listed in a stable order (UX-P1a, then UX-P2 through UX-P13). Agents filter by `applies_to` and `applies_in_phase` before citing.

### UX-P1a. Interaction cost over raw click count (discovery flows) {#ux-p1a}

- **rationale:** In novel or navigational flows, total mental plus physical plus error-recovery cost matters more than raw click count; a clearer four-click path can outperform a confusing three-click path.
- **how_to_check:** For each discovery flow in the spec, evaluate information scent, affordance clarity, and decision load at each step. Flag hidden navigation, weak information scent, missing affordances, and redundant prompts. Raw click count is not the criterion. If a spec cites "fewer clicks" as a success metric, translate it to "lower interaction cost" and ask where mental effort is being reduced versus increased.
- **counter_example:** A "three-click rule" flow that requires the user to guess which of three unlabeled icons is correct.
- **positive_example:** A Nielsen Norman Group case study where adding a fourth click to an e-commerce product-finding flow increased task success by 600 percent because information scent improved.
- **applies_to:** [gui, mobile, tui]
- **severity:** should-have
- **applies_in_phase:** [plan]
- **source:**
  - name: [Nielsen Norman Group — The 3-Click Rule for Navigation Is False](https://www.nngroup.com/articles/3-click-rule/)
  - url: https://www.nngroup.com/articles/3-click-rule/
  - archive_url: https://web.archive.org/web/2026/https://www.nngroup.com/articles/3-click-rule/
  - name: [Nielsen Norman Group — Interaction Cost: Definition](https://www.nngroup.com/articles/interaction-cost-definition/)
  - url: https://www.nngroup.com/articles/interaction-cost-definition/
  - archive_url: https://web.archive.org/web/2026/https://www.nngroup.com/articles/interaction-cost-definition/

### UX-P2. Recognition over recall {#ux-p2}

- **rationale:** Recall is the most expensive form of cognition in an interface; recognition is cheap and reliable, so visible options and cues beat invisible state the user has to remember.
- **how_to_check:** Walk the spec or diff as a first-time user. Every time the design assumes the user remembers a previous screen, recalls a command name, or guesses which hidden menu a feature lives in, flag it unless there is a discoverable fallback. Invisible keyboard shortcuts must have menu equivalents; power-user features must have visible entry points.
- **counter_example:** A modal wizard that hides the field the user needs to reference while filling in the next step.
- **positive_example:** Stripe's checkout showing a summary of what you are buying while you enter payment information.
- **applies_to:** [all]
- **severity:** should-have
- **applies_in_phase:** [plan]
- **source:**
  - name: [Nielsen Norman Group — 10 Usability Heuristics (Heuristic 6: Recognition rather than recall)](https://www.nngroup.com/articles/ten-usability-heuristics/)
  - url: https://www.nngroup.com/articles/ten-usability-heuristics/
  - archive_url: https://web.archive.org/web/2026/https://www.nngroup.com/articles/ten-usability-heuristics/

### UX-P3. No standalone buttons outside the exception list {#ux-p3}

- **rationale:** Material Design 3's FAB guidance is explicit: at most one floating primary-action button per screen, only when it is the single most important action. Every additional standalone button is clutter competing with the action that IS primary.
- **how_to_check:** For every standalone button in the spec or diff, confirm it belongs to the exception list: (a) form submit or confirm inside a form, (b) primary destructive confirmation such as Delete or Logout, (c) the single primary mobile action (maximum one Material FAB per screen), or (d) dialog or modal close. Every other button must justify itself against a contextual or inline alternative: direct manipulation on the object, a smart default that removes the need for the action, a keyboard shortcut, or an inline control on the row being edited.
- **counter_example:** A settings page with a floating "Save" button in the corner — violates the Material FAB rule; settings changes should save inline or via a contextual "Save changes" bar.
- **positive_example:** Apple Mail's swipe-to-archive — the action lives on the object, not in a toolbar.
- **applies_to:** [gui, mobile]
- **severity:** must-have
- **applies_in_phase:** [plan, check]
- **source:**
  - name: [Material Design 3 — Floating Action Button guidelines](https://m3.material.io/components/floating-action-button/guidelines)
  - url: https://m3.material.io/components/floating-action-button/guidelines
  - archive_url: https://web.archive.org/web/2026/https://m3.material.io/components/floating-action-button/guidelines

### UX-P4. Direct manipulation over control panels {#ux-p4}

- **rationale:** Shneiderman's 1983 framing holds: acting on the object itself (drag, swipe, inline edit) collapses "find the button, guess what it does, hope it worked" into one gesture and satisfies the visibility-of-system-status heuristic by construction.
- **how_to_check:** For every action in the spec or diff, check whether there is an object on screen representing the thing being acted on, and whether the user can act on it directly (click to edit, drag to reorder, checkbox on the row) instead of pressing a separate button elsewhere. Flag any "Edit/Delete/Reorder" toolbar buttons that could be inline.
- **counter_example:** A file browser where renaming a file requires a toolbar "Rename" button instead of click-to-edit in place.
- **positive_example:** macOS Finder — click a filename to rename it in place, drag to move, drop to copy.
- **applies_to:** [gui, mobile]
- **severity:** should-have
- **applies_in_phase:** [plan]
- **source:**
  - name: [Apple Human Interface Guidelines — Direct manipulation](https://developer.apple.com/design/human-interface-guidelines)
  - url: https://developer.apple.com/design/human-interface-guidelines
  - archive_url: https://web.archive.org/web/2026/https://developer.apple.com/design/human-interface-guidelines
  - name: [Shneiderman 1983 — Direct Manipulation: A Step Beyond Programming Languages](https://www.cs.umd.edu/~ben/papers/Shneiderman1983Direct.pdf)
  - url: https://www.cs.umd.edu/~ben/papers/Shneiderman1983Direct.pdf
  - archive_url: https://web.archive.org/web/2026/https://www.cs.umd.edu/~ben/papers/Shneiderman1983Direct.pdf

### UX-P5. Fitts-law target sizing {#ux-p5}

- **rationale:** Time-to-target is inversely proportional to target size; under-sized targets make an interface feel slow and fiddly regardless of any other quality.
- **how_to_check:** Verify minimum interactive target sizes: 44x44 pt on iOS, 48 dp on Android, and 24x24 px on dense desktop layouts. Verify adjacent-target spacing is sufficient to prevent accidental hits. Check CSS min-width and min-height or computed styles for every tap/click target, including icon-only buttons and close affordances.
- **counter_example:** Two icon buttons placed less than 44 px apart, causing fat-finger misclicks on mobile.
- **positive_example:** iOS navigation bars — large touch targets with generous spacing and edge placement.
- **applies_to:** [gui, mobile]
- **severity:** must-have
- **applies_in_phase:** [plan, check]
- **source:**
  - name: [Apple Human Interface Guidelines — minimum tap target guidance](https://developer.apple.com/design/human-interface-guidelines)
  - url: https://developer.apple.com/design/human-interface-guidelines
  - archive_url: https://web.archive.org/web/2026/https://developer.apple.com/design/human-interface-guidelines
  - name: [Material Design 3 — touch target guidance](https://m3.material.io/foundations/accessible-design/accessibility-basics)
  - url: https://m3.material.io/foundations/accessible-design/accessibility-basics
  - archive_url: https://web.archive.org/web/2026/https://m3.material.io/foundations/accessible-design/accessibility-basics
  - name: [Nielsen Norman Group — Fitts's Law and Its Applications in UX](https://www.nngroup.com/articles/fitts-law/)
  - url: https://www.nngroup.com/articles/fitts-law/
  - archive_url: https://web.archive.org/web/2026/https://www.nngroup.com/articles/fitts-law/

### UX-P6. Progressive disclosure {#ux-p6}

- **rationale:** Showing only what the common case needs improves learnability, efficiency, and error rate at once — the minority of users who need advanced options can reach them, while the majority are not overwhelmed.
- **how_to_check:** For every screen, identify which controls are needed by the 80 percent case and which are for the 5 percent who need them rarely. Controls that are not in the 80 percent case belong behind an "Advanced," "More," overflow menu, or settings surface. Flag flat lists of toggles that mix common and rare settings.
- **counter_example:** A settings page that exposes 47 toggles flat, alphabetized, overwhelming new users.
- **positive_example:** Stripe checkout hiding "Save for later" and "Promo code" behind expandable sections until the user opts in.
- **applies_to:** [all]
- **severity:** should-have
- **applies_in_phase:** [plan]
- **source:**
  - name: [Nielsen Norman Group — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
  - url: https://www.nngroup.com/articles/progressive-disclosure/
  - archive_url: https://web.archive.org/web/2026/https://www.nngroup.com/articles/progressive-disclosure/

### UX-P7. Information scent on navigation {#ux-p7}

- **rationale:** Users predict where a link or command will lead before clicking; when the prediction fails, they lose time, trust, and patience. Every label must communicate its destination.
- **how_to_check:** For every link, button, tab, and command label in the spec or diff, check that the label alone communicates where it leads or what it does. Reject "Click here", "Submit", "More", and unnamed sub-commands. Prefer labels that name the destination or the outcome, ideally with a count or status when available.
- **counter_example:** A "Click here for more" link with no indication of destination.
- **positive_example:** GitHub's "Open 47 pull requests" link — both the label and the count tell the user what they will see.
- **applies_to:** [gui, mobile, cli, tui]
- **severity:** must-have
- **applies_in_phase:** [plan, check]
- **source:**
  - name: [Nielsen Norman Group — Information Foraging / Information Scent](https://www.nngroup.com/articles/information-foraging/)
  - url: https://www.nngroup.com/articles/information-foraging/
  - archive_url: https://web.archive.org/web/2026/https://www.nngroup.com/articles/information-foraging/

### UX-P8. Forgiveness: undo over confirm {#ux-p8}

- **rationale:** Reversible actions enable fearless exploration; blocking confirmation dialogs create confirmation fatigue and train users to click through warnings without reading them.
- **how_to_check:** For every destructive operation, ask whether the action is reversible with undo and how the user discovers the undo. Reserve confirmation dialogs for truly irreversible destructive actions (account deletion, permanent data loss). Flag "Are you sure?" dialogs on non-destructive or easily-reversible actions.
- **counter_example:** An "Are you sure you want to mark this message read?" popup.
- **positive_example:** Gmail's Undo Send toast — the message is actually sent, but is reversible for ten seconds with one click.
- **applies_to:** [all]
- **severity:** should-have
- **applies_in_phase:** [plan]
- **source:**
  - name: [Nielsen Norman Group — 10 Usability Heuristics (Heuristic 3: User control and freedom)](https://www.nngroup.com/articles/ten-usability-heuristics/)
  - url: https://www.nngroup.com/articles/ten-usability-heuristics/
  - archive_url: https://web.archive.org/web/2026/https://www.nngroup.com/articles/ten-usability-heuristics/
  - name: [Apple Human Interface Guidelines — User control](https://developer.apple.com/design/human-interface-guidelines)
  - url: https://developer.apple.com/design/human-interface-guidelines
  - archive_url: https://web.archive.org/web/2026/https://developer.apple.com/design/human-interface-guidelines

### UX-P9. Smart defaults and inline validation {#ux-p9}

- **rationale:** Pre-filling the most likely value removes a decision the user would otherwise have to make; validating as the user types removes round-trip submit/error failures. Note the carve-out: this principle governs the product's behavior toward its end user; it does not override sno's own "never assume defaults" rule, which applies to Claude-to-user interaction during specification.
- **how_to_check:** For every required input field, ask whether the value can be inferred from session, locale, billing address, last submission, or a sensible product-level default. For every submit/error flow, ask whether the error can be caught inline as the user types. Every input must have a persistent visible label — placeholder-only labels fail (WCAG 3.3.2 Labels or Instructions). Errors must use plain-language text that names the field, describes the problem, and proposes a fix — generic codes like "Error 4032" are a FAIL (WCAG 3.3.1 Error Identification).
- **counter_example:** A form that rejects a submitted credit card with only "Error 4032" — a generic code with no hint of which field is wrong or how to fix it, paired with placeholder-only inputs that disappear when the user starts typing.
- **positive_example:** Stripe's card input — format-validates the card number in real time, suggests the detected card brand, and names the specific field and problem when validation fails.
- **applies_to:** [gui, mobile, cli]
- **severity:** should-have
- **applies_in_phase:** [plan]
- **source:**
  - name: [Stripe — Payment HTML forms: Best practices for conversion](https://stripe.com/resources/more/payment-html-forms)
  - url: https://stripe.com/resources/more/payment-html-forms
  - archive_url: https://web.archive.org/web/2026/https://stripe.com/resources/more/payment-html-forms
  - name: [W3C WCAG 3.3.1 Error Identification (Level A)](https://www.w3.org/WAI/WCAG21/Understanding/error-identification.html)
  - url: https://www.w3.org/WAI/WCAG21/Understanding/error-identification.html
  - archive_url: https://web.archive.org/web/2026/https://www.w3.org/WAI/WCAG21/Understanding/error-identification.html
  - name: [W3C WCAG 3.3.2 Labels or Instructions (Level A)](https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html)
  - url: https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html
  - archive_url: https://web.archive.org/web/2026/https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html

### UX-P10. Consistency within the product, then the platform {#ux-p10}

- **rationale:** Every deviation from established convention costs the user a learning moment; matching the product's own conventions first and the platform's second lets users reuse knowledge and focus on the app's unique value.
- **how_to_check:** For every label, icon, gesture, keyboard shortcut, and control placement, ask: does this match how the same concept is handled elsewhere in the product? If not, does it match the platform convention (macOS, iOS, Android, web)? Novel patterns are acceptable only when the product and platform conventions genuinely do not fit. Flag mixed navigation patterns (hamburger on one screen, bottom nav on the next) and clever icon re-use.
- **counter_example:** One screen uses a hamburger menu, the next uses a bottom nav bar — inconsistent within the product.
- **positive_example:** Apple Notes — every screen uses the same share sheet, the same toolbar placement, and the same gestures.
- **applies_to:** [gui, mobile]
- **severity:** must-have
- **applies_in_phase:** [plan, check]
- **source:**
  - name: [Nielsen Norman Group — 10 Usability Heuristics (Heuristic 4: Consistency and standards)](https://www.nngroup.com/articles/ten-usability-heuristics/)
  - url: https://www.nngroup.com/articles/ten-usability-heuristics/
  - archive_url: https://web.archive.org/web/2026/https://www.nngroup.com/articles/ten-usability-heuristics/

### UX-P11. Visible feedback within 100ms {#ux-p11}

- **rationale:** 100 ms is the limit for an action to feel instantaneous; without feedback inside that window users retry, lose trust, or assume the system is broken. This applies to terminal UIs as well — a TUI that waits 800 ms before redrawing feels just as dead as a web app that does.
- **how_to_check:** For every user action in the spec or diff, confirm that some visible (or TUI-visible) change occurs within 100 ms, even if the real work takes longer. Acceptable feedback includes skeleton loaders, spinners, optimistic state, progress bars, and cursor-state changes. Flag any action whose only feedback is the completion of the underlying request. Note that sighted-feedback alone does not satisfy WCAG 4.1.3 Status Messages; screen-reader-accessible status is owned by `accessibility-auditor`.
- **counter_example:** A button click that shows no change at all until the server responds 800 ms later.
- **positive_example:** GitHub's optimistic UI — a submitted comment appears in the thread instantly and rolls back on error.
- **applies_to:** [gui, mobile, tui]
- **severity:** must-have
- **applies_in_phase:** [plan, check]
- **source:**
  - name: [Nielsen Norman Group — Response Times: The 3 Important Limits (Jakob Nielsen, based on Miller 1968)](https://www.nngroup.com/articles/response-times-3-important-limits/)
  - url: https://www.nngroup.com/articles/response-times-3-important-limits/
  - archive_url: https://web.archive.org/web/2026/https://www.nngroup.com/articles/response-times-3-important-limits/

### UX-P12. Hierarchy via size, color, weight together {#ux-p12}

- **rationale:** Relying on a single visual axis (size alone, or color alone) to communicate hierarchy fails for colorblind users, for dark mode, and for low-contrast environments; multi-axis emphasis is robust across conditions.
- **how_to_check:** For every hierarchy decision (section headings, primary versus secondary actions, active versus inactive states), confirm the distinction uses at least two of: size, color/tint, weight/boldness, spacing, or iconography. Flag any "important" labels communicated by color alone. Color-independence proper is owned by `accessibility-auditor` (WCAG 1.4.1); this principle is about visual-design robustness, not WCAG conformance.
- **counter_example:** Red-only "important" labels that are invisible to colorblind users and unreadable in dark mode.
- **positive_example:** Apple's semibold, larger, tinted section headers — three axes of emphasis acting together.
- **applies_to:** [gui, mobile]
- **severity:** should-have
- **applies_in_phase:** [plan]
- **source:**
  - name: [Refactoring UI (Adam Wathan and Steve Schoger)](https://refactoringui.com/)
  - url: https://refactoringui.com/
  - archive_url: https://web.archive.org/web/2026/https://refactoringui.com/

### UX-P13. Constraint over customization {#ux-p13}

- **rationale:** A small number of well-chosen defaults beats an ocean of configuration knobs; every knob is a decision the user must make, a surface to support, and a source of differential bug reports. Opinionated products are easier to learn and faster to use.
- **how_to_check:** For every configuration option in the spec or diff, ask: does 99 percent of the user base need this? If not, can it be removed, or defaulted without exposing a toggle? Flag preferences panels that grow without a deletion discipline. This principle applies to CLI and TUI surfaces too — excessive flags and subcommands are the terminal equivalent of a 200-toggle preferences screen.
- **counter_example:** A preferences panel with 200 toggles, most of which 99 percent of users will never touch.
- **positive_example:** Linear — almost no user-facing configuration; the product has opinions and sticks with them.
- **applies_to:** [gui, mobile, cli, tui]
- **severity:** should-have
- **applies_in_phase:** [plan]
- **source:**
  - name: [Linear — How we redesigned the Linear UI (Part II)](https://linear.app/now/how-we-redesigned-the-linear-ui)
  - url: https://linear.app/now/how-we-redesigned-the-linear-ui
  - archive_url: https://web.archive.org/web/2026/https://linear.app/now/how-we-redesigned-the-linear-ui
