# Dynamic character manifest

`manifest.json` is the signed list of dynamically-loaded judges (seasonal/extra
characters) the app merges into its bundled roster. See
`dynamic_character_loading_one_pager.md` in the iOS repo for the full design.

## Files

- `manifest.json` — the character manifest (schema + kill switch + characters).
- `manifest.json.sig` — detached Ed25519 signature (base64) over the exact bytes
  of `manifest.json`. The app verifies this against a baked-in public key and
  **fails closed** (ignores the manifest) if it doesn't match.
- `*.png` — bundled character art for the core ten (served to the web landing
  page). Dynamic characters are **emoji-first** and need no art here.

## Editing a character / publishing

1. Edit `manifest.json`. **Bump the top-level `version`** (monotonic — the app
   rejects anything ≤ the last version it applied, so never reuse or lower it).
2. Re-sign (the private key lives **outside** any repo):

   ```sh
   VC_SIGNING_KEY=$(cat ~/.village-council/signing-key.b64) \
     swift web/tools/sign-manifest.swift
   ```

3. Commit `manifest.json` + `manifest.json.sig` together and push to Pages.

## Keys

- **Public key** (safe, committed): baked into the app as
  `ManifestSignature.publicKeyBase64`.
- **Private key** (secret, NEVER committed): `~/.village-council/signing-key.b64`,
  `chmod 600`. Back it up offline — losing it means you can't publish updates;
  leaking it lets anyone publish characters that pass verification.

## Scheduling & gates (per character)

- `availableFrom` / `availableUntil` — `yyyy-MM-dd`, inclusive; the character only
  appears inside the window. (Santa is wired for Dec 1 – Jan 6.)
- `minAppVersion` — hide from older app builds.
- Top-level `enabled: false` — global kill switch (safety hatch).
