# Frontend layout — who edits what

Each tab has its own folder. Work inside your folder and you will not collide with anyone.

```
src/
├── pages/
│   ├── simulator/          ← Simulator tab
│   │   ├── SimulatorPage.jsx   Page layout: 3D stage, controls dock, ranking, partial-gravity chart
│   │   ├── Viewport3D.jsx      3D scenes: procedural flame, cabin and habitat models
│   │   └── simulation.js       Presets + sources, match score, hazard and advisory rules
│   │
│   ├── library/            ← Library tab
│   │   ├── LibraryPage.jsx     Search, filters, investigation list, compare bar
│   │   ├── CompareModal.jsx    "What changed / what stayed the same" comparison
│   │   └── search.js           Local search with domain synonyms
│   │
│   └── earth/              ← On Earth tab
│       ├── EarthPage.jsx       Page layout
│       └── spinoffs.js         Text of the three spin-off blocks (edit content here)
│
├── shared/                 ← Used by every tab. Ask the team before changing.
│   ├── catalog.js              Data loader (backend → catalogo_limpio.json → mock), enums, labels, citations
│   ├── ui.jsx                  Buttons, tags, citations, modal, drawer, collapsible "More"
│   ├── InvestigationDetail.jsx Side drawer opened when clicking any investigation
│   └── CiteModal.jsx           "Cite data" dialog in the header
│
├── App.jsx                 ← Header, tab navigation, footer. Ask before changing.
├── index.css               ← Design tokens (colours, fonts, slider style). Ask before changing.
└── main.jsx
```

## Owners

| Folder | Owner | Can change freely |
|---|---|---|
| `src/pages/simulator/` | Simulator owner | Everything in the folder |
| `src/pages/library/` | Library owner | Everything in the folder |
| `src/pages/earth/` | On Earth owner | Everything in the folder |
| `src/shared/`, `App.jsx`, `index.css` | Whole team | Only after telling the others |

## How a page gets its data

Every page receives the same two props from `App.jsx`:

- `investigations` — the normalized PSI catalog (array, see `contracts/types.ts`).
- `onOpenDetail(inv)` — opens the shared detail drawer for an investigation.

The Simulator also receives `params`, `setParams`, `mode` and `setMode`, so its state survives tab switches.

## Working rules

- **Need a new shared piece?** Build it inside your page folder first. Move it to `shared/` only when a second tab needs it, and tell the team.
- **Reuse the design system:** colours like `text-ink`, `text-muted`, `bg-nasa-red` and `border-line` come from `index.css`; components like `Button`, `Tag`, `More` and `Citation` come from `shared/ui.jsx`. Don't hard-code new colours.
- **Compliance:** every investigation you show must display its `psi_id` and its citation (use `<CiteInline>` in lists, `<Citation>` in detail views). Mark SI-generated text with `<SITag>`. All UI text is in English. No NASA logos.
- **Don't edit** `contracts/` — it belongs to the data team.
- **Branches:** one branch per tab (for example `feat/ui-library`), merged into `feat/frontend-3d`.

## Run it

```bash
npm install
npm run dev
```
