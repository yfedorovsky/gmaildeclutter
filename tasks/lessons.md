# Lessons Learned

- **better-sqlite3 `db.transaction(fn)` returns a function** — you must CALL the returned function to execute. `db.transaction(() => { ... })` alone is a no-op. Use `db.transaction(() => { ... })()` or `const tx = db.transaction(fn); tx();`. Safest: use Drizzle's `await db.insert()` instead.
- **Drizzle `mode: "timestamp"` stores as Unix seconds, NOT milliseconds.** Raw SQL (`MIN()`, `MAX()`) returns seconds. Must `* 1000` when constructing `new Date()`, and divide span by `(60 * 60 * 24)` not `(1000 * 60 * 60 * 24)`.
- **Never "fix" code based on assumptions** — always verify the actual DB values before changing date math or unit conversions. Run `SELECT column FROM table LIMIT 1` to confirm units.
