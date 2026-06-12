# ServerLens 11.0 Security & Integrity Hardening Plan

- [x] Bind the local API to loopback (`127.0.0.1`) by default, with `SERVERLENS_BIND_HOST` override.
- [x] Add an optional local API token (`SERVERLENS_API_TOKEN`) that gates write operations over HTTP.
- [x] Add a 256KB request-body limit and strict JSON parsing to the HTTP path.
- [x] Replace `Math.random()` identifiers with `node:crypto` (`randomUUID`/`randomBytes`).
- [x] Make store server/job ids monotonic so retention deletes do not reuse numbers.
- [x] Add optional AES-256-GCM credential-at-rest envelope (`SERVERLENS_CRED_KEY`, default off).
- [x] Add `tests/security-hardening.test.js` (binding, token, body limit, id uniqueness, cipher round-trip + restart).
- [x] Upgrade package metadata to `11.0.0` and refresh DESIGN.md / README.md security notes.
- [x] Run source validation: test (66 pass), build, runtime smoke, UI evidence, and delivery validation (ready, 6/0/0).
