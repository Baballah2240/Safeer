# Design system: San Francisco font and one size system for controls - D134

Owner request (2026-11-20): use San Francisco (SF Pro) as the font, and make the sizes and colours of buttons and every other control consistent and professional across the project. Record the rules here.

## Font

| Where | Latin text | Arabic text |
|---|---|---|
| Apple devices (iPhone, iPad, Mac) | SF Pro (built into the device) | SF Arabic (built into the device) |
| Android, Windows, Linux (website) | Inter (bundled) | Noto Sans Arabic (bundled) |
| Safeer Driver and Passenger apps (Android) | Inter (bundled) | Noto Sans Arabic (bundled) |

Apple's SF Pro licence allows the font only for designing and building interfaces that run on Apple platforms. It must not be uploaded as a web font or bundled in an Android app. The website therefore asks for the system font first (`-apple-system`, `BlinkMacSystemFont`, `SF Pro Text`, `SF Pro Display`, and `SF Arabic` for Arabic). Apple devices show San Francisco, and all other devices fall back to the bundled Inter, the closest open design. The stacks are in `src/typography.css` (`--font-en`, `--font-ar`) and `src/home.css` (`--font`). Numbers keep tabular figures.

## Controls

`src/ui-system.css` is loaded last on every page (after `typography.css`; after `home.css` on the home page) and is registered in `config/assets.mjs`. It sets geometry and type only, so the light and dark themes and each company's own brand colour keep working. Print is unaffected.

| Control | Height | Corners | Text |
|---|---|---|---|
| Action button (`.primary`, `.staff-primary`, `.secondary`, `.btn`, `.market-find`, `.auth-submit`, `.track-submit`, `.journey-ticket-button`, `.auth-reveal`, `.drawer-nav-action`) | 48px | 12px | 15px, semibold |
| Compact button (inside tables and toolbars, `.btn-sm`) | 36px | 12px | 14px |
| Large button (`.btn-lg`) | 52px | 12px | 16px |
| Text-only button (`.text-button`) | 40px | 12px | 15px |
| Icon-only button (menu, close, bell, theme, header icons) | 44 x 44px | circle | - |
| Language switch | 44px | pill | 14px |
| Tabs and segmented choices | 44px | pill | 15px, semibold |
| Text field and menu | 48px (40px inside tables) | 12px | 16px (stops iPhone zoom) |

Colours:

- Main action: Safeer orange `#b9530f` (`--app-primary`), white text, hover `#a0470c`. The staff pages used green for their main button and now use orange too. Exception: on a staff page where the company has set its own brand colour, that colour is kept.
- Ordinary buttons: the surface colour with a thin border (unchanged).
- Selected tab: deep green `#123a2d` (unchanged).
- Danger: red text (unchanged).
- Focus: one 3px orange ring, 2px outside the control.
- Disabled: 50% opacity with a not-allowed cursor.

Seat maps (`.seat`, `.market-seat`, `.trip-seat`) keep their own shapes.

Mobile apps (`safeer_core` theme): filled and outlined buttons are now 48px tall with 12px corners (they were 52px and 16px), and text fields have 12px corners (they were 14px), matching the website.

## Before and after

The measurements below cover every visible button and field on the public pages: Booking, My Trips, Tracking, Driver sign-in, legal pages, staff sign-in and the home page, each at phone width (390px) and desktop width (1280px). The audit script is `.qa/audit-ui.mjs` and is not committed.

| Measurement | Before | After |
|---|---|---|
| Button heights | 32, 34, 38, 40, 44, 46, 48 and 56px | 44px (icons, tabs, language) and 48px (actions) |
| Button corners | 7, 8, 10, 15 and 16px, pill and circle | 12px, pill for tabs only, circle for icons only |
| Button text sizes | 13.3, 13.4, 14, 15.2, 16, 16.8 and 17px | 15px, and 14px for compact buttons |
| Field heights and corners | 40/8, 48/12, 52/12 and 56/16px | 48/12px (the tracking code box stays 52px) |
| Main button colour | orange or green | orange (or the company's brand colour) |

## Verification

Done:

- Flutter tests pass: safeer_core 26, Safeer Driver 34 and Safeer Passenger 30.

Not complete when this note was written:

- The full release verification (`npm run verify:release`) was still running, so this note does not record its result.
- The apps have not been rebuilt with the new button sizes. They change in the next release.
