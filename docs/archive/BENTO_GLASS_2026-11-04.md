# Bento grid and liquid glass - D41

Owner request: a project-wide bento-grid style with liquid-glass buttons, headers and sidebar. This follows the D40 Android USB checkpoint. It is a visual refresh only: no migration, API, permission, money, account or native package change.

## Delivered

src/tokens.css now holds one light and one dark glass palette, and src/theme.css is the shared finishing layer, loaded last on every page. Staff, company, finance and platform screens, Driver, Booking/marketplace and the fictional preview get rounded tiles, translucent glass controls, a floating top bar and a dark-glass sidebar. The staff overview is a 12-column bento grid of summary, shortcut and profile tiles. The marketplace header band is a rounded tile with the search card inside it. The old "tactile" paper/enamel block was removed from staff.css. The same 33 public assets are served.

Cards stay nearly opaque so text is readable. Blur is used only on navigation and controls, and solid fills replace it when blur is unsupported or reduced transparency is requested. Keyboard focus, 44-pixel touch targets, forced colors and reduced motion are kept. Arabic and English, both themes, seat states and printed output are unchanged.

## Fixed during review

Visual review corrected the following issues before the final browser run.

- Primary actions such as Search trips, Hold these seats and Create user looked the same as ordinary buttons, because the generic glass rule outranked the primary rule. They have their teal fill again.
- Sidebar menu items took the generic glass style. In light mode they were white pills on the dark sidebar, and the current page was not highlighted in either theme. The menus now keep their own dark-glass style and show the current page. Hovering the current item keeps its highlight.
- Held seats in staff seat maps used the darkened warning colour as a fill, which left dark text at about 3:1 contrast in light mode. They now use a separate amber fill token, warning-fill.
- In the fictional preview, a free seat turned light on hover in dark mode, a chosen seat lost its colour on hover, taken seats were hard to tell from free ones, and the seat key did not match. Taken seats now use the marketplace's hatched pattern, and the key matches all three states.
- The driver header lost its side margins below 1440 pixels and touched the screen edge. It was also wider than the content at 1920 pixels. The staff top bar was wider than its tiles on large screens. Both now line up with the content below them.
- The overview shortcut for Cities & destinations showed "undefined". This was missing since Section 05 and is visible now that the tiles show descriptions. It now reads "Shared city catalog for routes", with Arabic text.

The marketplace browser test checked the earlier layout: a full-width band, with the search card hanging off its bottom edge. It now checks the D41 layout: the band sits inside the page gutters and the search card sits inside the band.

## Verification

All nine affected built-browser workflows pass using fictional disposable PostgreSQL databases: identity, marketplace/company pages, reservations, station ticketing, driver boarding, platform/inbox, finance, the passenger preview and focused bento/accessibility checks. The seven business workflows cover 236 language/theme/viewport combinations; another 20 overview layouts include 320, 390, 768, 1366 and 1920 pixels, giving 256 combinations plus the preview workflow. Screenshots were reviewed for dark/light desktop, Arabic RTL and both physical phone screens. The focused checks verify unclipped overview cards, primary-action text, 44px language control, keyboard focus, reduced motion/transparency and forced-color blur fallback. Existing station/finance/preview print checks pass.

An initial Identity browser run exposed a timing race: the test read retained controls in a closed dialog while the new role form was fetching permissions. Modal fills and role-edit readiness now wait for the dialog to be open; no product authority or assertion was weakened. The marketplace layout assertion now checks the actual bento design. The final complete nine-workflow run passes. Unit/server tests (17), API/static build and mandatory documentation/link checks pass. All 33 running public asset hashes match the built manifest and are sent with no-store. Native database/security/concurrency tests from Section 15 remain historical evidence; no backend/migration logic changed in D41.

## Phones and the running server

The Driver and Booking apps load /driver and /marketplace from the running local server, which sends every asset with no-store. Rebuilding dist/ therefore reaches them without a new APK. Both installed apps were refreshed through the restored USB tunnel on the authorized LGN-NX1/API 36 phone and their actual screens inspected: dark Booking search and light Driver sign-in show the new design. The computer, local server and USB cable must stay connected as before.

## Limits

This is a local visual refresh. Physical printing remains untested; print output was checked through browser print media. The phone checks cover screen rendering, not full assigned-driver/payment operations. No native package, account or business data was reset. Commits stay local because pushing the shared branch would publish unrelated private portfolio history. See [current state](../CURRENT_STATE.md).

Source checkpoint: archives/Safeer-0.16.0-Bento-Glass-2026-11-04.zip with SHA-256 sidecar and per-file/CRC verification. It contains exact committed Safeer source and sanitized UI/live-asset verification receipts. It excludes runtime/accounts/credentials, dependencies, caches and APKs; retain the existing private business backup and saved Android artifacts separately.
