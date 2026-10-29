# STARLINK TV replacement validation — 2026-10-29

Working branch: `starlink/substituicao-samsung-20261028`, based on
`dc8bbd6e2c2048e230d4ba7617587701d951590d` (personal M81 account preview).

The unchanged baseline fails the classic entry size gate: 985718 bytes against
985700. A diagnostic fourth Terser pass produced the same 985718 bytes, so no
optimizer policy or size budget was changed.

This change removes redundant whitespace only inside the existing video-surface
inline CSS in `src/core/index.ts`. It preserves elements, nesting, IDs, boolean
attributes and parsed CSS declarations. A regression test compares the actual
TypeScript string literal with the previous DOM/CSS and requires a byte saving.
The test is included in `npm run test:starlink:tv`.

Run the standard size-gated build again after committing: dirty worktrees omit
the source revision in the embedded identity and must not be the final evidence.
Then run the packaged browser tests with intercepted network traffic before
staging/signing. Unit/browser fixtures do not validate a physical Samsung TV,
real login or decoding. Preserve the existing applications and certificates.

The owner selected the customized STARLINK Android application and authorized
only application delivery/download changes in M81. IPTV authentication, catalog,
publication and streaming remain outside that backend change. No backend or
operational data is changed by this TV branch.

## Verified result

Compiled source: `f5a20d878697dbf3e98bfa9ef49f0e6c1641b079`. The clean committed
build produced 985691 entry bytes (305047 gzip), passing the unchanged budget.
Typecheck, the DOM/CSS equivalence test, 14 TV contract tests and 320-script ES5
validation passed. Packaged Chromium tests passed Samsung/LG managed mode and
Samsung personal Xtream mode with intercepted synthetic traffic.

Tizen CLI successfully packaged the personal preview using the owner's existing
M81_SAMSUNG_VALIDATION profile. The WGT contains author/distributor signature
files. Size: 11947248 bytes; SHA256:
`e4ffc1001ebebfda85368704c130bd44a0e215175413781a5efd41ee216ca53c`.
Package: STLTVA0010.StarlinkTV, personal preview 0.1.2.

Delivery URL:
https://panel.taila5c5c2.ts.net/client-apps/download/starlink-iptv-samsung

The external GitHub check 40816738483 in sempaio/painel-m81-iptv-cloud verified
public DNS and a bounded HTTP range for this WGT without VPN. Full download
hashes were checked separately on local/domain requests at deployment.

No physical TV was connected to SDB. Installation, certificate/DUID acceptance,
real provider playback and Samsung store publication remain unverified; a signed
developer preview is not a universally installable store release. Later
documentation commits do not change the source identity compiled into this WGT.
