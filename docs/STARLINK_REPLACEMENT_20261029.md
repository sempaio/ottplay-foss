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
