Integrate this Orders Workspace V3 implementation bundle.

Rules:
- Keep the new `WorkspaceCommandCenter` generic. Do not make it order-specific.
- Do not reintroduce the old toolbar on Orders.
- Keep existing Orders search, status filter, channel filter, refresh, create, cancel and process behavior working.
- Disabled placeholder controls are intentional until real data/actions exist.
- Use existing Pagayo design tokens/classes where possible; do not add a new design library.

After copying the files, run typecheck/lint/tests and fix only real compile/test issues. Do not redesign the component.

Validation checklist:
- Orders header only shows title/subtitle/count, `Filter & functies`, and New/Create order in closed state.
- Clicking `Filter & functies` opens the wide command center below the header.
- Search field updates the existing Orders search state.
- Status checkboxes update the existing status filter state.
- POS/Webshop channel filter still works.
- Refresh action still works.
- New/Create order still opens the create order flow.
- Escape closes the command center.
- Outside click closes the command center.
- Mobile stacks into one column.
