# STARLINK TV personal M81 preview

This optional candidate opens the account's existing M81 Xtream catalog after
login. It does not require an M3U assignment. The managed player remains the
staging default, preserved on `starlink/tv-generico-m81` at `dd7c33b`.

The TV package contains the panel origin, branding and player, with no account
credentials or bundled channels. Login uses the same `/player_api.php` Xtream account check as Android, then
rechecks authorization every 120 seconds. No `/app/auth` session is created, so
logging in does not revoke existing Android app sessions. The entered username/password stay
in memory for the Xtream requests; reopening the personal app requires login.
Xtream requests necessarily include credentials in HTTPS URLs to the panel.
Do not log those URLs. No supplier credentials are requested from the user.

Live categories and streams use the standard split API endpoints and the existing
shared Core normalization. Movies and series use the existing lazy Xtream media
adapter, including actual series episode IDs. There is no name-based `[24H]`
classification, fabricated episode, or backend reclassification in this change.
The Android design is not reproduced; this is the STARLINK-branded FOSS TV UI.

Periodic checks retain the loaded catalog; the explicit refresh button reloads
it. This personal mode does not poll publication revisions automatically.

The Samsung identity is `STLTVA0010.StarlinkTV`, separate from the generic preview.
Logout stops the driver, cancels pending requests and clears this preview's
sandbox, then reloads. Blue opens the account panel. Publication 289, deployed
containers, databases, Android and previously generated packages are untouched.

```sh
npm run test:starlink:tv
npm run typecheck
npm run build
STARLINK_CHROMIUM=/usr/bin/chromium node tests/test_starlink_tv_browser.cjs
node scripts/stage-starlink-tv.cjs samsung https://panel.taila5c5c2.ts.net account
```

The browser tests intercept all remote traffic with synthetic accounts, live,
movie and episode fixtures. They are not a test of the real provider or decoder.
The staging manifest records commit, dirty state and static file hashes.
A ZIP of the staged directory with `.wgt` extension is an unsigned candidate;
installation still requires the installer's supported signing flow and a working
TV developer connection. The T4300/Tizen 5.5 minimum is a target, not hardware
validation. This does not resolve Apps2Samsung's debug-port connection warning.

## Login investigation, 2026-10-24

A bounded real account-info GET returned HTTP 200, auth 1, Active. The previous
request briefly returned 503; the public health endpoint returned 200. Credentials,
URLs containing them, account payloads and subscriber data were not saved. The
old TV dialog conflated missing fields, 401 and 403, so its screenshot cannot
establish which happened. The 0.1.2 candidate removes the extra login API, maps
safe error codes to distinct messages and shows panel origin/build version.
Tizen 5.5 does not support CSS `inset`; explicit edges now cover the boot layer.
Physical TV validation is still required. No real app-session POST was issued.
