# Veli UI/UX implementation and validation

Date: 2026-10-09

Implemented the [improvement plan](ui-ux-improvement-plan.md) with the existing
React, MUI, and Emotion stack. Toss's action-focused writing and progressive
information display informed the experience. No `@toss/tds-mobile` or additional
UI dependencies were added.

## Experience changes

- Organize files → credentials → process/save with explicit primary actions.
- Default to passwords, combine random/word generation options, and disclose
  public-key entry and generation as advanced capabilities.
- Mask passwords/private keys, explain storage and loss, support key backup,
  and confirm replacing an existing key pair.
- Start processing/downloads together in streaming mode. Offer a separate
  result download in buffered mode. Ask users to confirm saving in browser
  downloads rather than assuming device storage is complete.
- Report success after whole-file verification. Explain partial-download
  disposal and retry after failures. Do not show invented progress percentages.
- Confirm clipboard success only after writing; offer selectable manual-copy
  text when browser permissions deny the operation.
- Preserve drafts across back/tab actions. Block tabs/language during work and
  confirm stream cancellation. Correlate late download-preparation replies
  with request IDs.
- Use explicit themes, 44px minimum actions, persistent labels, keyboard focus,
  live status, long-filename wrapping, and readable Korean line breaks.

## Language scope

Only English (`en_US`) and Korean (`ko_KR`) are imported and selectable. An
unsupported stored locale falls back to Korean for Korean browser settings,
otherwise English. Both files have the same 266 translation keys; direct
translation calls have no missing entries.

Changing language confirms clearing selected files, credentials, and results;
it is disabled while processing. Other locale sources remain for possible
future additions and are not shipped. English help was updated and Korean help
added. Repository documentation is English; the original changelog is retained.

## Structure and compatibility

- `FileWorkflow.js`: shared presentation for four processing adapters.
- Existing regular/limited panels: streaming/buffered processing adapters.
- `WorkflowContext.js`: aggregate busy/dirty state for navigation and language.
- `src/components/ui/`: shared copy and public/private-key entry behavior.
- `src/config/Theme.js` and `locales/`: themes and supported copy.

The existing signatures, Argon2id parameters, X25519 exchange,
XChaCha20-Poly1305 encryption, and 64 MiB chunk format remain. The worker change
adds a request ID to preparation replies without changing cryptographic format.

## Validation of the UI/UX implementation

- Production/static build and worker generation passed.
- ESLint passed without warnings or errors.
- Twelve security tests passed, including real 64 MiB boundaries,
  corruption/truncation, concurrency, cancellation, and preparation correlation.
- Full Playwright regression: 77 passed, 8 intentionally skipped. The skips
  are Chromium-only controlled cancellation and Firefox-only persistent-profile
  checks on the other four profiles; no failures remained.
- Locale-key parity, direct key usage, and `git diff --check` passed.
- Korean help/404 pages had no browser errors. Korean 320px/390px screens and
  desktop 200% enlargement had no horizontal overflow. Main/secondary text and
  primary-button color pairs in both themes exceeded 4.5:1 contrast. This is
  not an accessibility certification of every component.

Projects cover Chromium, Firefox, desktop WebKit, iPhone 13 WebKit, and iPad
Pro 11 WebKit. Tests compare downloaded plaintext bytes for password/key round
trips and cover `/headless/`, storage restrictions, malformed/non-final files,
large-file metadata, Korean round trips, language reset confirmation, clipboard
rejection, key backup/replacement, invitation links, narrow layouts, themes,
and controlled stream cancellation.

Normally run `npm run build`, install Playwright browsers/dependencies, then
`npm run test:browser`. In this environment, a blocked Chromium download required
system Chromium. Additional WebKit libraries were installed in a task directory
and actual browser execution was verified. Those launch changes used a temporary
configuration and did not modify repository dependencies or Playwright settings.

## Veli naming

The current product name, page titles, help, package metadata, local container
tag, and repository links use Veli. The README, help introduction, and footer
retain the lineage from hat.sh through Hatsmith. Repository documents are
English; app help remains English/Korean. Legacy format identifiers and the
existing changelog remain unchanged.

Naming validation passed the production build (including lint), three Chromium
password/public-key round trips, and 50 route checks across English/Korean and
the five browser profiles. Route checks covered titles, active brand headings,
the favicon, lineage links, and the current repository link without browser
errors. Package and lockfile names agree; changelog, license, and legacy format
identifiers were checked against the original bytes.

## Remaining release checks

Linux WebKit device profiles are not physical iOS Safari. Confirm saving to
Files, background transitions, low-memory behavior, private browsing, and
reentry after worker updates on real iPhone/iPad devices. The buffered 1 GiB
input limit is not a processing guarantee; devices may require smaller files.

Novice-user checks from the plan remain unmeasured. Validate protect → download
→ reopen without extra explanation. Add languages later through a separate
translation and browser-validation effort.
