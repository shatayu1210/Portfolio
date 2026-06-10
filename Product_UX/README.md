# Product & UX

This section documents how I approach **product thinking and user-centric design** — not as a separate discipline from engineering, but as part of how I decide what to build and whether it works for real people.

The work here falls into three buckets:

| Section | What it shows | Best for viewers who care about… |
| :--- | :--- | :--- |
| [Highlight Reel](#highlight-reel) | Breadth of product exploration across platforms | Quick scan — versatility and visual craft |
| [Interaction Prototypes](#interaction-prototypes) | Redesign thinking on real consumer/product flows | User empathy, usability, iteration before code |
| [Visual Communication](#visual-communication) | Static assets for outreach and messaging | Early-stage teams that need clear external communication |

For shipped, production UI tied to real systems, see the [UberEats platform walkthrough](../Distributed_EventDriven_Platform#-ui-walkthrough).

---

## Tools

All work in this folder was created in **Adobe XD** (interaction prototypes, screen flows, clickable concepts) and **Adobe Illustrator** (marketing layouts, typography, and visual assets). Screen recordings were exported from XD to demonstrate motion and state changes.

---

## Highlight Reel

**File**: [`highlight-reel.mp4`](./highlight-reel.mp4) (~5.5 MB)

A condensed walkthrough of product exploration work — interaction prototypes and visual concepts across e-commerce and desktop environments. Useful if you want a 1–2 minute overview before diving into individual pieces.

[🎥 Watch highlight reel](./highlight-reel.mp4)

---

## Interaction Prototypes

Screen recordings exported from **Adobe XD**. Each piece starts from a real product surface, identifies a user friction point, and explores a clearer interaction model. These are **concept explorations**, not production implementations — the goal is to show how I reason about usability before writing code.

### Amazon — Dark Theme Exploration
**File**: [`prototypes/amazon-dark-theme.mp4`](./prototypes/amazon-dark-theme.mp4)

| | |
| :--- | :--- |
| **Surface** | E-commerce product browsing (Amazon-style flow) |
| **User problem** | Bright UIs cause eye strain during long browsing sessions, especially at night — but dark modes often hurt scannability and trust if done poorly |
| **Product goal** | Adapt a high-traffic shopping flow to low-light contexts without hiding hierarchy, pricing, or primary CTAs |
| **What I explored** | Contrast balance, card legibility, and navigation affordances in a dark palette |

[🎥 Watch prototype](./prototypes/amazon-dark-theme.mp4)

### Amazon — Filter Redesign
**File**: [`prototypes/amazon-filter-redesign.mp4`](./prototypes/amazon-filter-redesign.mp4)

| | |
| :--- | :--- |
| **Surface** | Product search and filtering |
| **User problem** | Dense filter panels slow decision-making; users lose context switching between filters and results |
| **Product goal** | Reduce steps from search intent → relevant results |
| **What I explored** | Filter grouping, progressive disclosure, and layout that keeps results visible while refining |

[🎥 Watch prototype](./prototypes/amazon-filter-redesign.mp4)

### Windows — Default Window Behavior
**File**: [`prototypes/windows-default-window.mp4`](./prototypes/windows-default-window.mp4)

| | |
| :--- | :--- |
| **Surface** | Desktop OS window management (multi-window apps) |
| **User problem** | Opening an app with several windows already in session either restores the first window opened or brings them all back at once — cluttered and unpredictable when you only need one specific view |
| **Product goal** | Let users pin a default window per app so only that window opens every time, regardless of how many were left open previously |
| **What I explored** | Default-window pinning, predictable launch behavior, and reducing restore clutter on app open |

[🎥 Watch prototype](./prototypes/windows-default-window.mp4)

---

## Visual Communication

**Files**: [`marketing/`](./marketing/) — brochure, email campaign visual

Static collateral built in **Adobe Illustrator** — included here for completeness. The engineering-relevant work in this folder is the [interaction prototypes](#interaction-prototypes) above: how I identify user friction, explore interaction models, and iterate before writing production code.

| Asset | File | Context |
| :--- | :--- | :--- |
| Brochure | [`brochure.png`](./marketing/brochure.png) | Multi-panel layout for structured product/event messaging |
| Email campaign | [`email-poster.jpg`](./marketing/email-poster.jpg) | Single-focus visual for email and digital outreach |

| Brochure | Email Campaign |
| :---: | :---: |
| ![Brochure](./marketing/brochure.png) | ![Email poster](./marketing/email-poster.jpg) |

---

## How This Connects to My Engineering Work

| Engineering project | Product/UX connection |
| :--- | :--- |
| [Distributed Event-Driven Platform](../Distributed_EventDriven_Platform) | Full customer + restaurant UI shipped in React — discovery, cart, checkout, live tracking |
| [AgenticAI AutoBot](../AgenticAI_AutoBot) | Built around real developer workflows: triage, alerts, and actionable output — not raw model dumps |
| [AI CleanSQL](../AI_CleanSQL) | Makes complex data-quality problems approachable through a usable query interface |

---

[← Back to Portfolio](../)
