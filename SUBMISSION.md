# Take-Home Assignment Submission: The Untested API

## 1. Overview & Summary
This submission delivers a complete test suite, bug investigation report, fix for a critical pagination bug, and implementation of the `PATCH /tasks/:id/assign` endpoint with full test coverage for the Task Manager API.

---

## 2. Test Strategy & Architecture
The test suite is structured into unit and integration tests located under `task-api/tests/`:

- **Unit Tests (`tests/unit/taskService.test.js` & `tests/unit/validators.test.js`):**
  - Directly test pure business logic and validation helpers in isolation.
  - Verify task creation defaults, query operations, edge-case calculations (e.g. overdue stats), state mutations, and ID lookups.
  - Test all validator branches (valid payloads, missing fields, type errors, empty strings, whitespace strings, invalid enums, invalid ISO dates).
- **Integration Tests (`tests/integration/tasks.test.js`):**
  - Use Supertest against the Express `app` to verify HTTP status codes, headers, and payload structures.
  - Test happy paths and edge cases for every existing and new endpoint:
    - `GET /tasks` (all, status filter, 1-based pagination, pagination beyond total tasks)
    - `GET /tasks/stats` (initial zero state, accurate counts, overdue exclusion for completed tasks)
    - `POST /tasks` (201 created with defaults, 400 on missing or invalid input)
    - `PUT /tasks/:id` (200 update, 404 for unknown ID, 400 on invalid fields)
    - `DELETE /tasks/:id` (204 No Content, 404 for unknown ID)
    - `PATCH /tasks/:id/complete` (200 complete, 404 for unknown ID)
    - `PATCH /tasks/:id/assign` (200 assigned, 200 reassigned, 404 unknown ID, 400 validation failures)
- **Test Isolation:**
  - The in-memory data store in `taskService.js` exports a `_reset()` function.
  - Every test file executes `taskService._reset()` in a `beforeEach()` hook, guaranteeing test independence and zero leakage between tests.

---

## 3. Test & Coverage Results

All 75 automated tests pass with zero failures:

```
PASS tests/unit/validators.test.js
PASS tests/unit/taskService.test.js
PASS tests/integration/tasks.test.js

-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-----------------|---------|----------|---------|---------|-------------------
All files        |   97.43 |    98.85 |   93.33 |   97.18 |                   
 src             |   69.23 |       75 |       0 |   69.23 |                   
  app.js         |   69.23 |       75 |       0 |   69.23 | 10-11,17-18       
 src/routes      |     100 |      100 |     100 |     100 |                   
  tasks.js       |     100 |      100 |     100 |     100 |                   
 src/services    |     100 |      100 |     100 |     100 |                   
  taskService.js |     100 |      100 |     100 |     100 |                   
 src/utils       |     100 |      100 |     100 |     100 |                   
  validators.js  |     100 |      100 |     100 |     100 |                   
-----------------|---------|----------|---------|---------|-------------------

Test Suites: 3 passed, 3 total
Tests:       75 passed, 75 total
Snapshots:   0 total
```

- **Target:** >= 80% coverage
- **Achieved:** **97.43% Statements, 98.85% Branches, 93.33% Functions, 97.18% Lines**
- Uncovered lines in `app.js` are solely the fallback `app.listen()` port listener block when run as a standalone script and the global 500 error handler.

---

## 4. Bug Report Summary
A detailed bug report is available in [`BUG_REPORT.md`](./BUG_REPORT.md). Summary of discovered bugs:

1. **Bug 1: 1-Based Pagination Offset Calculation Skips Page 1 Results (Fixed)**
   - *Location:* `src/services/taskService.js:11-14`
   - *Problem:* Offset calculated as `page * limit`. For `page=1, limit=10`, `offset = 10`, skipping items 0–9.
   - *Fix:* `const pageNum = Math.max(1, page); const offset = (pageNum - 1) * limit;`
2. **Bug 2: `completeTask` Overwrites Task Priority to 'medium'**
   - *Location:* `src/services/taskService.js:69`
   - *Problem:* Completing a high-priority task resets its priority to `'medium'`.
3. **Bug 3: `getByStatus` Performs Substring Search Instead of Exact Match**
   - *Location:* `src/services/taskService.js:9`
   - *Problem:* Uses `t.status.includes(status)` instead of strict equality `t.status === status`.

---

## 5. Bug Fix Explanation
We selected **Bug 1 (Pagination Offset)** as the primary bug to fix:
- **Rationale:** `GET /tasks?page=1&limit=10` is an explicitly documented public endpoint. In the original code, asking for page 1 caused a complete omission of the first page of tasks. Because `parseInt(page) || 1` coerces page 0 to 1, the first `limit` items in the database were permanently inaccessible through pagination.
- **Approach:** Changed `const offset = page * limit;` to:
  ```javascript
  const pageNum = Math.max(1, page);
  const offset = (pageNum - 1) * limit;
  return tasks.slice(offset, offset + limit);
  ```
- **Regression Testing:**
  - `tests/unit/taskService.test.js` (`should return the correct slice of tasks for page 1 and page 2`)
  - `tests/integration/tasks.test.js` (`should return paginated list when ?page and ?limit are provided`)
  Both tests initially failed with `Expected: "Task 1", Received: "Task 3"` and now pass cleanly.

---

## 6. Implementation of `PATCH /tasks/:id/assign`

### Endpoint Behavior
- **URL:** `PATCH /tasks/:id/assign`
- **Request Body:** `{ "assignee": "string" }`
- **Response:** `200 OK` with the full updated task object including `assignee`.
- **404 Not Found:** `{ "error": "Task not found" }` if `:id` does not exist.
- **400 Bad Request:** `{ "error": "assignee is required and must be a non-empty string" }` if `assignee` is missing, not a string, empty, or whitespace-only.

### Design Decisions

1. **Validation of Empty and Whitespace Strings:**
   - Empty strings (`""`) and whitespace-only strings (`"   "`) are rejected with `400 Bad Request` and error message `"assignee is required and must be a non-empty string"`.
   - Valid string inputs have leading and trailing whitespace trimmed before being stored (`assignee.trim()`), ensuring clean data storage without accidental formatting issues.
   - Non-string types (numbers, objects, booleans) are rejected with `400 Bad Request`.

2. **Explicit Decision: "What if the task is already assigned?"**
   - **The Question:** The assignment brief specifically asks: *"What if the task is already assigned?"*
   - **Existing Codebase Precedent:**
     - In `PATCH /tasks/:id/complete`, calling complete on a task that is *already completed* does not error or return `409 Conflict`; it re-applies the completion state idempotently and returns `200 OK`.
     - In `PUT /tasks/:id`, updating fields replaces previous values without conflict.
     - Across the entire API, only standard status codes (`200`, `201`, `204`, `400`, `404`, `500`) are used. No locking or conflict codes exist.
   - **Evaluation of Alternatives:**
     - *Option A — Reassignment / Overwrite (Chosen):*
       - When a task already has an assignee (e.g. `"Alice"`), sending a request with `{ "assignee": "Bob" }` updates the assignee to `"Bob"` and returns `200 OK` with the updated task.
       - *Rationale:* In standard workflow tracking systems (e.g., Jira, Linear, Asana, GitHub Issues), tasks are routinely handed off between team members. Requiring an explicit unassignment step before reassigning introduces unnecessary round trips and artificial friction. Furthermore, per RFC 5789, HTTP `PATCH` expresses partial modification of resource state; updating an attribute to a new target value is the canonical behavior.
     - *Option B — Strict Conflict (409 Conflict):*
       - Rejecting reassignment with `409 Conflict` would be appropriate if tasks were exclusive locks that could only be released by the original assignee. However, this Task Manager API has no authentication, user ownership, or lock mechanics. Introducing a 409 error would break client expectations for simple task handoffs.
   - **Integration Test Verification:**
     - Verified by integration test: `should allow reassigning a task that already has an assignee and return 200` in `tests/integration/tasks.test.js`.
     - Verified by unit test: `should reassign a task that already has an assignee` in `tests/unit/taskService.test.js`.

3. **Data Preservation:**
   - All other existing task attributes (`id`, `title`, `description`, `status`, `priority`, `dueDate`, `completedAt`, `createdAt`) are strictly preserved when an assignee is added or changed.


---

## 7. Submission Questions & Reflections

### What you would test next with more time
1. **Concurrent Request Stress Testing:** Under high concurrency, verify how JavaScript event loop ticks interact with the in-memory array operations.
2. **Malicious / Extra Field Injection:** Test sending unexpected or prohibited fields in `PUT /tasks/:id` and `POST /tasks` (e.g. attempting to tamper with `id`, `createdAt`, or prototype pollution via `__proto__`).
3. **Rate Limiting & Payload Limits:** Test edge cases where extremely large request bodies or rapid request spikes are sent to the server.
4. **Timezone & Leap Year Dates:** Test edge-case ISO date strings (`2026-02-29`, timestamps with millisecond offsets and UTC offsets like `+05:30`).

### Anything that surprised you in the codebase
1. **Priority reset on task completion:** In `taskService.completeTask`, explicitly overriding `priority: 'medium'` was surprising and looked like copy-paste remnant code from an initial scaffold.
2. **Substring matching for status filters:** Using `t.status.includes(status)` instead of strict equality was unexpected, as it means filtering for `status=do` would return both `todo` and `done` tasks.
3. **Missing `GET /tasks/:id`:** Although `taskService.findById` exists and `:id` is used in `PUT`, `DELETE`, and `PATCH`, there is no `GET /tasks/:id` endpoint defined in the routes.

### Questions you would ask before shipping this to production
1. **Database & Persistence:** What persistent storage layer (e.g. PostgreSQL, MongoDB, Redis) will replace the in-memory array for production clustering and zero-downtime deploys?
2. **User Directory & Authorization:** Should `assignee` be an arbitrary display name string or a foreign key/UUID validated against an authenticated User identity service?
3. **Pagination Metadata:** Should `GET /tasks` return an envelope with pagination metadata (e.g. `{ data: [...], pagination: { total, page, limit, totalPages } }`) rather than a raw array?
4. **Authentication / Multitenancy:** How will tenant isolation and user authentication (e.g., Bearer JWT) be handled across all task operations?
