# STARLINK TV: empty managed player preview

## Delivered boundary

The Samsung/Tizen and LG/webOS candidates use the same OTT-play FOSS codebase,
with STARLINK branding and an M81 assignment gate. Installation starts without
channels or a selected provider. The user signs into M81; the operator assigns
the playlist later. The TV checks revisions without requiring a new package.

This first candidate integrates M81's existing **M3U source assignment**, not a
new backend. It does not claim Android catalog/UI parity or structured Xtream
movie/season/episode navigation. Those require a separate, evidenced catalog
contract; an empty episode list must never be turned into invented episodes.
Android, DLNA and screen mirroring are unchanged by this TV work.

## Provenance and preservation

- Repository: `sempaio/ottplay-foss`.
- Base: `5018806dc9b77928e6302362a701c7b896cac1a0`.
- Work branch: `starlink/tv-generico-m81`; base checkout was clean.
- Upstream player, shared Core, device adapters, copyright and license notices
  remain. The overlay does not replace AVPlay/webOS playback with an Android APK.
- The logo is reused unchanged from `sempaio/ottplay-foss-android`, client code
  commit `f25fafdcc39ab91390c428dd21dbdb5dda8d90f5`, file
  `native/app/src/main/res/drawable-nodpi/starlink_logo.png`.
- LG preview app ID: `com.starlink.iptv.tv.preview`.
- Samsung preview app ID/package: `STLTVP0010.StarlinkTV` / `STLTVP0010`.
- Preview identities do not intentionally replace older STARLINK installations.
- No operational containers, database, source assignments, publication 289,
  certificates, private configuration or deployed app was changed.

## Remote contract

The candidate calls only the configured HTTPS M81 API origin for authentication
and assignment. The API origin is a build parameter, not a bundled content source.

1. `POST /app/auth/login` receives login/password/device ID. The password field is
   cleared immediately; the password is not persisted or placed in URLs.
2. The bearer token and expiry live in sessionStorage, outside FOSS local-storage
   exports. This preview may require login again after fully closing the TV app.
3. `GET /api/v1/tv-m3u/source?platform=samsung|lg` uses Authorization and X-Device-ID.
4. `configured=false` shows a waiting screen. No source/demo is loaded.
5. A valid assignment provides an HTTP(S) playlist URL and revision. Only the
   managed M3U driver is admitted; credentials for M81 are not sent to that URL.
6. A revision change reloads the assigned source. Repeated revisions do not.
7. Revocation, expiry or a failed assignment check stops playback and blocks the
   player. Network/configuration failures are retryable and do not report an
   empty provider catalog as their cause.
8. Logout clears the managed profile, including source URL, favorites/history
   and preferences in **this preview app's sandbox**, while preserving its device
   ID. Once the player has run, logout reloads the empty app to retire in-memory
   library state too. This prevents one account's saved catalog state entering
   the next account. The blue remote key opens the account/logout panel.

The source is polled at the server interval (clamped to 10–300 seconds), with an
earlier expiry check. Late responses after logout/new operations are ignored.
The source driver is disposed when admission is revoked. Real firmware stop
behavior must still be qualified on hardware.

## Build and verify

```sh
npm ci --ignore-scripts
npm run test:starlink:tv
npm run typecheck
npm run build
node scripts/stage-starlink-tv.cjs samsung https://panel.taila5c5c2.ts.net
node scripts/stage-starlink-tv.cjs lg https://panel.taila5c5c2.ts.net
```

Each staging invocation creates a **new** directory under `build/starlink-tv`;
existing candidates are never overwritten. The output includes the empty shell,
classic player, M3U runtime, assets, original notices and platform manifest.
`starlink-build.json` records revision, dirty state and per-file SHA-256 values.
No private settings, tests, accounts or media are copied into the candidate.
The packaged Samsung manifest uses Tizen 5.5 as a tentative minimum, not a tested
support claim. LG's minimum supported firmware remains to be qualified.

For built-package browser verification:

```sh
npx playwright install chromium
node tests/test_starlink_tv_browser.cjs
```

An existing Chromium can be selected with `STARLINK_CHROMIUM`. The test serves
the actual staged app locally and intercepts every external request. M81, account,
playlist and stream data are synthetic. Both platform variants traverse login,
unassigned waiting, remote assignment, driver admission and logout. It also
checks that demo/alternative drivers are not admitted and no unrelated remote
service is contacted. Screenshots are test evidence, not bundled content.

LG packaging uses the official `ares-package` CLI against the staged LG directory.
Samsung still requires Tizen packaging/signing with the operator's existing
certificate and a separate device check. Do not create replacement certificates
or install into an existing production app identity merely to validate a build.
The workflow `starlink-tv.yml` builds isolated artifacts only; it has no deployment.

## Validation performed and remaining work

Executed locally: ten new lifecycle/DOM tests, both built-package browser journeys,
the existing device detector checks, Demo/source switching regression suite,
provider-storage reset tests, TypeScript checking, correctness lint, focused
new-file lint and classic ES5 production build. The test inventory is reachable
from the dedicated workflow. No Android binary, APK signature or Core artifact
was changed.

Physical Samsung/LG validation remains necessary for native keyboard/focus,
Back/Magic Remote, packaged-file URLs, API CORS for the real app origin, HTTPS,
decoder stop, codecs/containers, long playback and standby/resume. No real M81
account was used and no real media was fetched in this work. A browser test is
not an AVPlay/webOS media certification or store approval.

Keep structured series/movie contract work separate from this preview. Reuse M81
editorial identities and the actual series responses before adding those screens.
Do not present this first M3U candidate as a finished equivalent of Android 0.3.2.
