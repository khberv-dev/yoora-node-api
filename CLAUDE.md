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

- **Auth (`common/guards/api-key.guard.ts`).** `ApiKeyGuard` is a global `APP_GUARD`. It compares the SHA-256 of the `x-api-key` header with that of `API_KEY` in constant time. A missing or wrong key returns 401. Routes marked `@Public()` (`common/decorators/public.decorator.ts`) skip the check. Only `GET /health` (returns `{ok: true}`, for load balancers and monitoring) is public; keep it that way for anything that touches `wg0`.
- **Errors.** `ApiErrorLoggingFilter` logs every failed request, including its body and headers. Headers pass through `redactHeaders` (`common/utils/http-log.util.ts`), which masks `x-api-key`, `authorization` and `cookie`. Add any new secret header to that set.
- **Validation.** The global `ValidationPipe` uses `whitelist` + `forbidNonWhitelisted` + `transform`, so unknown body fields return 400.
- **No global prefix, no CORS.** The service talks only to the main server, so it has no `/v{N}` prefix and no `enableCors`.
- **System (`modules/system`).** `ShellService` wraps `execFile` (no shell, 10s timeout, 1 MB buffer). `WgProcessService` builds `awg set wg0 peer ...` / `awg show wg0 dump` on top of it and is the module's only export. The `awg` CLI and a configured `wg0` interface must exist on the host, so these calls fail locally on macOS. To try them locally, put a stub `awg` script first on `PATH`.
- **Connection (`modules/core`).** `ConnectionController` → `ConnectionService` → `CryptService` + `WgProcessService`. The node generates keys and assigns IPs itself; the main server only sends the API key, never a body.
  - `POST connection` (no body) generates an x25519 key pair (`modules/crypt`, copied from the main server), takes the lowest free IP in `10.0.0.2`–`.254`, and registers the peer with `allowed-ips <ip>/32`. It returns 201 `{private, public, ip: "10.0.0.N/32", serverPublicKey}`, the same shape the main server used to build itself. The private key is not stored anywhere, so this response is the only copy.
  - `DELETE connection/:ip` (bare IPv4, e.g. `10.0.0.3`) removes the peer that holds that IP. It returns 204, or 404 if no peer has it.
  - `GET connection` parses `awg show wg0 dump` into `[{publicKey, endpoint, allowedIps, latestHandshake, transferRx, transferTx}]`. It skips the dump's first line on purpose, because that line holds the interface **private key**.
- **IP allocation needs no storage.** The used IPs are read from the `wg0` dump on every connect, so allocation survives restarts and reuses freed IPs. `connect()` runs one request at a time through a promise-chain lock, so concurrent requests can't get the same IP. This only holds inside a single process: never run two instances against the same `wg0`. When the subnet is full, the request returns 503.
- **Startup.** `ConnectionService.onApplicationBootstrap` runs before the app starts listening. It reads the server public key (`awg show wg0 public-key`, kept for the life of the process) and logs `wg0 up: port …, public key …, peers N/253 (M active)`, where active means a handshake within the last 180s. If `awg` or `wg0` is unavailable, startup fails with exit code 1 instead of serving requests that would all 500. Locally, this means a stub `awg` script must be on `PATH` even to boot. If `awg` fails during a request, `ShellService` logs stderr and the request returns 500.

## Conventions

- ESM project (`"type": "module"`, `module: nodenext`): relative imports **must** end in `.js`. `main.ts` uses top-level `await`.
- Tests use Vitest, not Jest (`vi.fn()`, globals enabled).
- oxlint treats `no-floating-promises` as an error.
