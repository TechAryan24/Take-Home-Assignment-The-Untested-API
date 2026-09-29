# Submission Notes

**Take-Home Assignment — The Untested API**

---

## 1. Key Design Decisions

### A. The `/tasks/:id/assign` Endpoint & Reassignment Behavior
The assignment brief specifically asked:
> *"What should happen if `assignee` is an empty string? What if the task is already assigned?"*

We evaluated the architectural context of the codebase and made deliberate, documented decisions:

1. **Reassignment Policy: In-Place Update (`200 OK`):**
   - **Decision:** Sending a second `PATCH /tasks/:id/assign` request with a new assignee replaces the existing assignee and returns the updated task with `200 OK`.
   - **Codebase Precedent:** In `PATCH /tasks/:id/complete`, completing an already-completed task does not trigger a `409 Conflict`; it re-executes idempotently. Similarly, `PUT /tasks/:id` overwrites fields without locking. Across the API, no 409 status codes or concurrency locks exist.
   - **Domain Fit:** In modern task trackers (Jira, Linear, GitHub Issues), tasks are routinely transferred between owners. Returning 409 would force clients into an artificial unassign-then-assign sequence, introducing race conditions and latency.
   - **REST Semantics:** RFC 5789 states that `PATCH` applies partial modifications to a resource; updating an attribute is standard behavior.

2. **Validation of Empty & Whitespace Strings:**
   - Empty strings (`""`) and whitespace-only strings (`"   "`) are rejected with `400 Bad Request`:
     `{ "error": "assignee is required and must be a non-empty string" }`.
   - Non-string types (numbers, objects, booleans) return `400 Bad Request`.
   - Valid string inputs have leading and trailing whitespace trimmed before persisting (`assignee.trim()`).

3. **Data Integrity:**
   - All other existing task attributes (`id`, `title`, `description`, `status`, `priority`, `dueDate`, `completedAt`, `createdAt`) are strictly preserved.

### B. Bug Fix Prioritization
We prioritized **Bug 1 (Pagination Offset Calculation)** over other findings:
- `GET /tasks?page=1&limit=10` is an explicitly documented public route in `ASSIGNMENT.md`.
- In the original code, the calculation `offset = page * limit` skipped the entire first page of tasks. Because `parseInt(page) || 1` coerced `page=0` to `1`, items `0` through `limit - 1` were permanently inaccessible under pagination.
- It was caught by automated unit and integration tests and fixed cleanly with `offset = (Math.max(1, page) - 1) * limit`.

---

## 2. What I Would Test Next

With additional time, here are the concrete testing areas I would expand:

1. **Concurrent Requests & Race Conditions:**
   - Since the datastore is an in-memory array (`let tasks = []`), concurrent asynchronous requests mutating the array (e.g. concurrent `DELETE` and `PUT` calls) could trigger race conditions or index misalignments. I would write concurrency stress tests using `Promise.all` over hundreds of simultaneous requests.
2. **Boundary Conditions for Pagination:**
   - Fuzz testing negative page numbers (`?page=-5`), non-numeric strings (`?page=abc`), floating-point values (`?page=1.5`), and zero/negative limits (`?limit=-1`).
3. **Invalid Date Parsing Edge Cases:**
   - `Date.parse()` in JavaScript can exhibit implementation-dependent quirks with ambiguous date formats. I would test invalid leap years (`2026-02-29`), epoch numbers, and dates with millisecond/time-zone offsets.
4. **State Machine Transitions:**
   - Test whether completed tasks (`status: 'done'`) should be allowed to transition back to `'todo'` or `'in_progress'` via `PUT`, or whether completion is a terminal state.
5. **Performance with Large Collections:**
   - Benchmark array performance, search times in `getByStatus`, and memory footprint when the dataset grows to 50,000+ tasks in-memory.

---

## 3. What Surprised Me in the Codebase

1. **`completeTask` Priority Downgrade:**
   - In `taskService.completeTask`, line 69 explicitly set `priority: 'medium'`. If a user created an urgent task with `priority: 'high'` and completed it, its priority was silently corrupted to `'medium'`. This looked like an unintended copy-paste artifact from the default task template.
2. **Substring Matching in `getByStatus`:**
   - `taskService.getByStatus` used `t.status.includes(status)` rather than strict equality `t.status === status`. As a result, querying `?status=do` returned both `todo` and `done` tasks.
3. **Missing `GET /tasks/:id` Endpoint:**
   - While `taskService` implemented `findById(id)` and the API provided `PUT /tasks/:id`, `DELETE /tasks/:id`, `PATCH /tasks/:id/complete`, and `PATCH /tasks/:id/assign`, there was no route for retrieving a single task by ID (`GET /tasks/:id`).
4. **Query Parameter Precedence:**
   - In `GET /tasks`, if a client supplied both `status` and pagination parameters (`?status=todo&page=1&limit=5`), the `if (status)` branch executed first and returned all matching tasks, completely ignoring the pagination parameters.
5. **Specification Discrepancy Between Docs:**
   - In `README.md`, valid statuses were described as `pending | in-progress | completed`, while `ASSIGNMENT.md` and the actual source code implemented `todo | in_progress | done`. We followed `ASSIGNMENT.md` as authoritative.

---

## 4. Questions Before Shipping to Production

1. **Persistent Storage Layer:**
   - What database (e.g., PostgreSQL, MongoDB, Redis) should replace the in-memory array to ensure data persists across server restarts, crashes, and horizontal container scaling?
2. **User Identity & Assignee Authorization:**
   - Should `assignee` remain an arbitrary display-name string, or should it validate against a centralized User directory / foreign key (e.g. `userId: UUID`) with role-based access control?
3. **Standardized Response Envelope & Pagination Metadata:**
   - Should `GET /tasks` return an envelope containing metadata (e.g. `{ data: [...], pagination: { total, page, limit, totalPages } }`) rather than a bare array, so frontend clients know when the last page is reached?
4. **Max Limit Guards:**
   - What hard maximum limit (e.g. `limit <= 100`) should be enforced to prevent memory exhaustion from requests like `?limit=1000000`?
5. **Authentication & Multi-Tenancy:**
   - What authentication mechanism (e.g., Bearer JWT, API keys) will be used to scope tasks to individual users or organizations?
