# STARLINK Samsung store preparation

## Confirmed product

The user chose a generic **Xtream** player. Mode `open` starts with an empty
server field; users enter their own HTTP(S) server origin, username and password.
No M81 suggestion, preselected service, account, playlist or content is included.
The previous managed and personal modes remain available on their own branches.
The backend, publication 289 and Android are unchanged.

The open mode uses standard account-info, live categories/streams and lazy
movie/series APIs. Account credentials stay in memory; a relaunch requires login.
Invalid fields and remote failures have distinct messages. An on-device
information/privacy panel explains data flow, third-party services and HTTP.
The startup Return key opens an exit confirmation; confirming uses the TV API.

## Candidate build

```sh
npm run test:starlink:tv
npm run typecheck
npm run build
STARLINK_CHROMIUM=/usr/bin/chromium \
STARLINK_STORE_SCREENSHOTS=/absolute/private-output/screenshots \
node tests/test_starlink_tv_browser.cjs
node scripts/stage-starlink-tv.cjs samsung unused open
```

`unused` is intentionally not an API origin in this mode. The config contains an
empty `apiBase`. Only the Xtream provider bundle is copied. Existing native
system-font staging removes historical web fonts/Fontello; the inherited favicon
is removed. Original notices and licenses remain. Identity `STLTVG0010.StarlinkTV`
is provisional; confirm uniqueness and the registered identity before signing.
Version 0.2.0 is a candidate, unsigned and not hardware-certified.

The browser journeys cover both earlier generic platforms, the personal Samsung
mode and the new open mode. All service traffic is intercepted. Open-mode tests
verify empty startup, explicit server selection, no app-auth/M81 requests,
validation, privacy, Return, live/movie/episode IDs and logout. Screenshots are
actual UI captures; service data is synthetic, not provider content.

## Submission dossier

The separate, user-facing preparation kit contains PT-BR/EN listing drafts,
structured metadata, four JPEG screenshots at 1920x1080 under 500 kB, evaluator
instructions, a privacy draft/HTML, physical test sheet, signing/upload guidance,
original and transparent logo assets, and hashes. Publisher contact belongs to
the owner's dossier, not a credential or a runtime network endpoint.

The owner has a Seller Office account; earlier uploads concerned another app.
No Seller Office session, app registration, signing profile or Tizen CLI is
available here. No submission, publication or remote app install has been made.

The English listing draft is a translation, not English UI support. Current UI is
Portuguese; select only actually supported languages and tested model groups.
The public privacy URL, review source/account, permanent app identity, final
certificate and hardware playback results must be completed before certification.

## License review

The root MIT grant does not resolve the explicitly undocumented inherited code
grant in `docs/legacy-provenance.md`. That distribution-rights question remains
open. Historical Fontello files are excluded using the existing transformation;
this closes that font-specific packaging exposure, not every provenance question.
Storefront assets and test content must also be covered by the publisher's rights.

## Official references checked 2026-10-24

- [Samsung launch checklist](https://developer.samsung.com/smarttv/develop/distribute/launch-checklist.html)
- [Samsung UX checklist](https://developer.samsung.com/smarttv/design/ux-checklist.html)
- [Certificates](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/creating-certificates.html)
- [TV Seller Office](https://seller.samsungapps.com/tv)

The launch checklist requires signatures, manifest, consistent title, UI guide,
logo/background images, four appropriately sized screenshots, listing, privacy
URL when applicable, support and test access. These references are requirements,
not approval or a guarantee of acceptance. The portal may require more fields.
