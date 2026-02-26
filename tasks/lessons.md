# Lessons Learned

- **better-sqlite3 `db.transaction(fn)` returns a function** — you must CALL the returned function to execute. `db.transaction(() => { ... })` alone is a no-op. Use `db.transaction(() => { ... })()` or `const tx = db.transaction(fn); tx();`. Safest: use Drizzle's `await db.insert()` instead.
- **Drizzle `mode: "timestamp"` stores as Unix seconds, NOT milliseconds.** Raw SQL (`MIN()`, `MAX()`) returns seconds. Must `* 1000` when constructing `new Date()`, and divide span by `(60 * 60 * 24)` not `(1000 * 60 * 60 * 24)`.
- **Never "fix" code based on assumptions** — always verify the actual DB values before changing date math or unit conversions. Run `SELECT column FROM table LIMIT 1` to confirm units.
- **Worker process requires manual restart after code changes.** Next.js dev server hot-reloads API routes, but `tsx src/worker/index.ts` is a long-running process that loads code once at startup. Always restart the worker after modifying pipeline code (scanner, grouper, etc.).
- **Never add concurrency caps without matching release() calls.** Adding `maxConcurrent` to a rate limiter that uses `acquire()` but no `release()` causes deadlocks. Verify all callers properly release before shipping.
