# Bug Report: Task Manager API

This document details the bugs identified in the Task Manager API through code inspection and automated testing with Jest and Supertest. Per the project brief, bugs were identified through test failure rather than guesswork.

---

## Bug 1 — 1-Based Pagination Offset Calculation Skips Page 1 Results (Fixed)

### Expected behavior
According to [`ASSIGNMENT.md`](./ASSIGNMENT.md#L36), `GET /tasks?page=1&limit=10` is an explicitly documented endpoint for paginated results. In standard 1-based pagination:
- `page=1, limit=10` should return items at indices `0` through `9` (offset = 0).
- `page=2, limit=10` should return items at indices `10` through `19` (offset = 10).

### Actual behavior
When requesting `page=1, limit=2` (or `limit=10`), the API calculates `offset = 1 * limit`, skipping the first page of items entirely. 
Furthermore, in [`src/routes/tasks.js`](file:///d:/Projects/Take-Home-Assignment-The-Untested-API/task-api/src/routes/tasks.js#L20-L21), the route handler parses the page with:
```javascript
const pageNum = parseInt(page) || 1;
```
Because `parseInt("0")` returns `0` (which is falsy in JavaScript), querying `?page=0` is automatically coerced to `1`. Consequently, tasks stored at indices `0` through `limit - 1` could **never** be retrieved by any client using pagination.

### Location
- File: [`task-api/src/services/taskService.js`](file:///d:/Projects/Take-Home-Assignment-The-Untested-API/task-api/src/services/taskService.js#L11-L14)
- Lines: 11–14
```javascript
const getPaginated = (page, limit) => {
  const offset = page * limit;
  return tasks.slice(offset, offset + limit);
};
```

### How the bug was discovered
Discovered by writing standard happy-path tests for pagination in both the unit and integration test suites:
- **Unit test:** `tests/unit/taskService.test.js` (`should return the correct slice of tasks for page 1 and page 2`)
- **Integration test:** `tests/integration/tasks.test.js` (`should return paginated list when ?page and ?limit are provided`)

Upon running `npm test`, both test suites failed with the exact same off-by-one assertion error:

```
FAIL tests/unit/taskService.test.js
  ● taskService (Unit Tests) › getPaginated › should return the correct slice of tasks for page 1 and page 2

    expect(received).toBe(expected) // Object.is equality

    Expected: "Task 1"
    Received: "Task 3"

      102 |       const page1 = taskService.getPaginated(1, 2);
      103 |       expect(page1).toHaveLength(2);
    > 104 |       expect(page1[0].title).toBe('Task 1');
          |                              ^
      105 |       expect(page1[1].title).toBe('Task 2');

FAIL tests/integration/tasks.test.js
  ● Task API Routes (Integration Tests) › GET /tasks › should return paginated list when ?page and ?limit are provided

    expect(received).toBe(expected) // Object.is equality

    Expected: "Task 1"
    Received: "Task 3"

      46 |       expect(res.status).toBe(200);
      47 |       expect(res.body).toHaveLength(2);
    > 48 |       expect(res.body[0].title).toBe('Task 1');
         |                                 ^
      49 |       expect(res.body[1].title).toBe('Task 2');
```

### Why it happens
The formula `offset = page * limit` assumes a 0-indexed page number (`0 * limit = 0`). However, the API contract, query documentation, and route defaults treat `page` as 1-indexed. For `page = 1`, multiplying by `limit` produces an offset equal to `limit`, skipping the first batch of results.

### Suggested fix & verification
Adjust the formula to compute a 1-based offset:
```javascript
const getPaginated = (page, limit) => {
  const pageNum = Math.max(1, page);
  const offset = (pageNum - 1) * limit;
  return tasks.slice(offset, offset + limit);
};
```
**Verification:** After applying this fix in `taskService.js`, both regression tests passed immediately (`75 passed, 75 total`).

---

## Bug 2 — `completeTask` Unconditionally Overwrites Task Priority to 'medium'

### Expected behavior
Per [`ASSIGNMENT.md`](./ASSIGNMENT.md#L40), `PATCH /tasks/:id/complete` represents "Mark as complete". Completing a task should transition its `status` to `'done'` and set `completedAt` to the current ISO timestamp. The task's other existing attributes—specifically its `priority` (`'high'`, `'low'`)—must remain intact for reporting, metrics, and audit history.

### Actual behavior
When any task is completed, its `priority` is overwritten and reset to `'medium'`, destroying any previously configured priority level. For example, an urgent task created with `priority: 'high'` becomes `priority: 'medium'` upon completion.

### Location
- File: [`task-api/src/services/taskService.js`](file:///d:/Projects/Take-Home-Assignment-The-Untested-API/task-api/src/services/taskService.js#L67-L72)
- Lines: 67–72
```javascript
const updated = {
  ...task,
  priority: 'medium', // <--- Inadvertent priority downgrade
  status: 'done',
  completedAt: new Date().toISOString(),
};
```

### How the bug was discovered
Discovered during test creation and code inspection of `completeTask`. Writing a test verifying that an existing `priority: 'high'` task maintains its priority upon completion:
```javascript
const task = taskService.create({ title: 'Urgent Bug', priority: 'high' });
const completed = taskService.completeTask(task.id);
expect(completed.priority).toBe('high');
```
Fails with:
```
Expected: "high"
Received: "medium"
```

### Why it happens
The object spread in `completeTask` contains a hardcoded `priority: 'medium'` property after `...task`, likely copied from the default object declaration in `create()`.

### Suggested fix
Remove the `priority: 'medium'` line from `completeTask`:
```javascript
const completeTask = (id) => {
  const task = findById(id);
  if (!task) return null;

  const updated = {
    ...task,
    status: 'done',
    completedAt: new Date().toISOString(),
  };

  const index = tasks.findIndex((t) => t.id === id);
  tasks[index] = updated;
  return updated;
};
```

---

## Bug 3 — `getByStatus` Performs Substring Search Instead of Exact Match

### Expected behavior
Filtering by status (`GET /tasks?status=todo` or `taskService.getByStatus('todo')`) should only return tasks whose status strictly matches the requested value. Querying an arbitrary substring like `status=do` should not match tasks with status `todo` or `done`.

### Actual behavior
`taskService.getByStatus` uses `String.prototype.includes`:
```javascript
const getByStatus = (status) => tasks.filter((t) => t.status.includes(status));
```
Because `"todo".includes("do")` and `"done".includes("do")` are both `true`, querying `?status=do` returns both `todo` and `done` tasks. Similarly, `?status=pro` returns `in_progress` tasks.

### Location
- File: [`task-api/src/services/taskService.js`](file:///d:/Projects/Take-Home-Assignment-The-Untested-API/task-api/src/services/taskService.js#L9)
- Line: 9

### How the bug was discovered
Discovered during service layer analysis and edge case test formulation:
```javascript
taskService.create({ title: 'Task 1', status: 'todo' });
const results = taskService.getByStatus('do');
// Expected: []
// Actual: [ { title: 'Task 1', status: 'todo' } ]
```

### Why it happens
The implementation uses `.includes(status)` instead of strict equality `===`.

### Suggested fix
Change the filter condition to strict equality:
```javascript
const getByStatus = (status) => tasks.filter((t) => t.status === status);
```

---

## Bug 4 — `validateUpdateTask` Allows Empty String Values for Status and Priority

### Expected behavior
Sending `PUT /tasks/:id` with `{ "status": "" }` or `{ "priority": "" }` should be rejected with `400 Bad Request`, as empty strings are not valid enum values.

### Actual behavior
In [`src/utils/validators.js`](file:///d:/Projects/Take-Home-Assignment-The-Untested-API/task-api/src/utils/validators.js#L24-L29):
```javascript
if (body.status && !VALID_STATUSES.includes(body.status)) {
  return `status must be one of: ${VALID_STATUSES.join(', ')}`;
}
```
If `body.status` is `""`, the truthy check `if (body.status)` evaluates to `false`. The validation block is completely bypassed, and `taskService.update` sets `status: ""` on the task.

### Location
- File: [`task-api/src/utils/validators.js`](file:///d:/Projects/Take-Home-Assignment-The-Untested-API/task-api/src/utils/validators.js#L24-L29)
- Lines: 24–29

### How the bug was discovered
Discovered when fuzz-testing update validation edge cases with empty string inputs.

### Why it happens
Using `body.status &&` conflates "field is provided" with "field is truthy". An empty string `""` is falsy, so the check fails to execute.

### Suggested fix
Use `body.status !== undefined` instead:
```javascript
if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
  return `status must be one of: ${VALID_STATUSES.join(', ')}`;
}
if (body.priority !== undefined && !VALID_PRIORITIES.includes(body.priority)) {
  return `priority must be one of: ${VALID_PRIORITIES.join(', ')}`;
}
```
