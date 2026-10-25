# Propel (desktop app) - CLAUDE.md

Propel is a Windows PC care app: Electron + React + Zustand, packaged with electron-builder (NSIS).
This repo is the desktop app only. The backend (Express on Render, Supabase, Razorpay) and the website are separate repos.
Owner works in Hinglish. Reports to him can be short and direct. Code, comments and commit text stay in English.

## Working rules (read first)
- Work directly on `main`. Do NOT create branches.
- Do NOT commit, push, tag, publish or deploy unless the owner explicitly says so.
- You cannot run the GUI or take screenshots. Do NOT try to launch the app. Verify with typecheck, build and tests, then list what the owner must check by hand.
- Never claim something works without real command output. Paste actual output, not a summary.
- Do not touch the v1.4.0 release record or its signature. Releases go through the repo's release script only (see package.json).
- Keep changes small and scoped to the task. No drive-by refactors, no new dependencies without saying why.
- If the request contradicts the code or these rules, stop and say so before building.

## Verify before reporting done
- `npx tsc --noEmit` must exit 0.
- `npm run build` must compile with 0 errors.
- Run any existing test script related to the area you changed.
- Final report: files changed, what was verified (real output), what is NOT verified, manual checks for the owner.

## Architecture
- `electron/` main process: `ipc/` handlers, `preload/` bridges (e.g. `aiBridge.ts`), `services/` logic (e.g. `services/ai/pcAdvisorService.ts`).
- `src/` React UI: pages, `components/`, Zustand stores.
- Renderer never touches Node or the filesystem directly. Everything goes renderer -> preload bridge -> IPC handler -> service.
- New IPC channel = handler + preload bridge + types, all three, and validate every argument in the handler.
- App id `com.propel.desktop`. User data in `%APPDATA%\propel`:
  `propel_device_id.json`, `propel_license.json`, `propel_maintenance.json`, `propel_exclusions.json`.
  Never rename these files or change their shape without a migration that reads the old format.
- Single-instance lock and tray/background mode exist. Do not break closing-to-tray or the lock.
- Scheduled cleanup runs through a Windows Task Scheduler task that launches the app with `--scheduled-maintenance`. Keep that argument and its headless path working.

## Plans and gating (rules, not numbers)
- Plans: FREE, PRO, MAX (MAX is kept in code; do not remove or hide it unless asked). 7-day PRO trial exists.
- The backend is the source of truth for plan, limits and quota. The app only reads the entitlement and shows it.
- Never hardcode prices, limits or plan names in the app. Read them from the entitlement response or one shared constants file.
- Gating that matters (scheduler, PC Advisor quota, device limit) must be enforced server-side. App-side locks are UX only.
- Offline: the app uses the saved plan and shows "Offline: using saved plan". Never silently upgrade a plan offline.
- Free features must stay free. Before changing any badge or lock, check the real plan check in code. UI labels, the website pricing table and code must match.

## Backend and auth
- Backend URL stays unchanged unless the owner says otherwise. Keep it in one config place, never scattered strings.
- Desktop login uses a browser handoff with PKCE (code_verifier, S256 challenge, state nonce, one-time code). Do not weaken it or log the verifier, code or tokens.
- The app never holds API keys (Gemini, Razorpay, Supabase service role). If you find one, report it and stop.
- PC Advisor: the app sends system info to the backend, which calls Gemini. Never send file contents, file names from user folders, or personal data. Show friendly errors, never raw backend errors.
- Do not add the retry or quota logic in the app. The backend owns it.

## Safety (this app deletes files and changes the system)
- Cleaner and Duplicate Finder: never delete without an explicit user review step. Respect `propel_exclusions.json`.
- Prefer recycle bin / safe removal over permanent delete where the feature allows it.
- Startup Manager, memory and boost actions must be reversible and must never touch protected system entries or critical processes.
- Never build shell commands by string concatenation. Use argument arrays, validate paths and IDs, and refuse paths outside the allowed locations.
- No elevated (admin) actions unless the feature truly needs it, and keep them as narrow as possible.

## Privacy and logging
- No telemetry or logs with file paths, usernames, emails, tokens or system specs unless the owner asked for it.
- Errors shown to users are friendly and actionable. Technical detail goes to the console/log only.

## UI conventions
- Sidebar: WORKSPACE (Dashboard, System Check, Cleaner, Duplicate Finder, Memory, Performance, Startup), AUTOMATION (Smart Maintenance), SYSTEM (AI Features, Settings, About). Keep names identical to the website pricing table.
- Each page has one header with title, subtitle and one primary action button at top right. Never show two buttons for the same action.
- Scans are manual. Do not auto-run a scan when a page opens.
- Keep the existing visual style: light theme, green accent, rounded cards, same card padding across pages.
- Every empty, loading and error state must be designed. No placeholder table headings in empty states.
- Never show raw errors, stack traces or "undefined" to the user.

## Features parked for later (do NOT add unless asked)
Software Updater, Uninstaller, Game Mode, Permissions page, a separate Settings-based plan screen.

## Release notes for the agent
- Version bumps and installers go through the release script only, and only when the owner asks.
- Code signing is not set up yet. Do not add signing config or change SmartScreen guidance.
- Before any release PR or tag: typecheck, build, and a list of manual test steps for the owner.
