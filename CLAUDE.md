# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A NestJS 12 edge service for the Yoora VPN. Many instances run, one per VPN node, and each one is called **only by the main server** (`../yoora-vpn-api`). There are no users, JWTs, or database here. Every instance has its own `API_KEY`, and the main server sends it in the `x-api-key` header.

The structure mirrors `../yoora-vpn-api`: `src/common/` (filters, guards, pipes, utils) and feature modules in `src/modules/<name>`. Imports are relative (no `@/` alias).

## Commands

```bash
npm install
npm run start:dev      # watch mode
npm run build          # nest build -> dist/main.js
npm run start:prod     # node dist/main
npm run lint           # oxlint --type-aware over src/ and test/
npm run format         # prettier (single quotes, trailing commas)
npm test               # vitest unit tests (**/*.spec.ts)
npx vitest run src/path/to/file.spec.ts   # single test file
npx vitest run -t "test name"             # tests matching a name
npm run test:e2e       # vitest e2e tests (**/*.e2e-spec.ts)
```

There are no tests and no `test/` folder yet, although the `lint` and `format` scripts reference one.

## Environment

`.env.example` is the source of truth. It has two variables, both required: `PORT` and `API_KEY` (unique per instance). If `API_KEY` is missing or empty, the app refuses to start.

## Architecture

- **Auth (`common/guards/api-key.guard.ts`).** `ApiKeyGuard` is a global `APP_GUARD` and covers every route, including the `GET /` health check. It compares the SHA-256 of the `x-api-key` header with that of `API_KEY` in constant time. A missing or wrong key returns 401. There is no `@Public()` escape hatch. If a route ever needs one, add a decorator and check it in the guard.
- **Errors.** `ApiErrorLoggingFilter` logs every failed request, including its body and headers. Headers pass through `redactHeaders` (`common/utils/http-log.util.ts`), which masks `x-api-key`, `authorization` and `cookie`. Add any new secret header to that set.
- **Validation.** The global `ValidationPipe` uses `whitelist` + `forbidNonWhitelisted` + `transform`, so unknown body fields return 400.
- **No global prefix, no CORS.** The service talks only to the main server, so it has no `/v{N}` prefix and no `enableCors`.
- **System (`modules/system`).** `ShellService` wraps `execFile` (no shell, 10s timeout, 1 MB buffer). `WgProcessService` builds `awg set wg0 peer ...` / `awg show wg0 dump` on top of it and is the module's only export. The `awg` CLI and a configured `wg0` interface must exist on the host, so these calls fail locally on macOS. To try them locally, put a stub `awg` script first on `PATH`.
- **Connection (`modules/core`).** `ConnectionController` → `ConnectionService` → `WgProcessService`. This node is stateless: the main server generates keys and allocates IPs, and this node only applies them to `wg0`.
  - `POST connection {publicKey, ip}` registers the peer with `allowed-ips <ip>/32` and returns 201 `{publicKey, ip: "<ip>/32"}`. `ip` must be a bare IPv4 address. Re-posting an existing key updates its allowed IPs.
  - `DELETE connection {publicKey}` returns 204. The key goes in the body because base64 keys contain `/`.
  - `GET connection` parses `awg show wg0 dump` into `[{publicKey, endpoint, allowedIps, latestHandshake, transferRx, transferTx}]`. It skips the dump's first line on purpose, because that line holds the interface **private key**.
  - `publicKey` is validated as a 44-character base64 WireGuard key (`WG_KEY_PATTERN` in `dto/peer-key.dto.ts`). If `awg` fails, `ShellService` logs stderr and the request returns 500.

## Conventions

- ESM project (`"type": "module"`, `module: nodenext`): relative imports **must** end in `.js`. `main.ts` uses top-level `await`.
- Tests use Vitest, not Jest (`vi.fn()`, globals enabled).
- oxlint treats `no-floating-promises` as an error.
