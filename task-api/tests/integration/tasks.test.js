const request = require('supertest');
const app = require('../../src/app');
const taskService = require('../../src/services/taskService');

describe('Task API Routes (Integration Tests)', () => {
  beforeEach(() => {
    taskService._reset();
  });

  describe('GET /tasks', () => {
    it('should return an empty array when no tasks exist', async () => {
      const res = await request(app).get('/tasks');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return all tasks', async () => {
      taskService.create({ title: 'Task 1' });
      taskService.create({ title: 'Task 2' });

      const res = await request(app).get('/tasks');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBe('Task 1');
      expect(res.body[1].title).toBe('Task 2');
    });

    it('should filter tasks by status when ?status is provided', async () => {
      taskService.create({ title: 'Task 1', status: 'todo' });
      taskService.create({ title: 'Task 2', status: 'in_progress' });
      taskService.create({ title: 'Task 3', status: 'done' });

      const res = await request(app).get('/tasks?status=todo');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('Task 1');
      expect(res.body[0].status).toBe('todo');
    });

    it('should return paginated list when ?page and ?limit are provided', async () => {
      for (let i = 1; i <= 5; i++) {
        taskService.create({ title: `Task ${i}` });
      }

      const res = await request(app).get('/tasks?page=1&limit=2');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBe('Task 1');
      expect(res.body[1].title).toBe('Task 2');
    });

    it('should default limit to 10 when only ?page is provided', async () => {
      for (let i = 1; i <= 15; i++) {
        taskService.create({ title: `Task ${i}` });
      }

      const res = await request(app).get('/tasks?page=1');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(10);
      expect(res.body[0].title).toBe('Task 1');
    });

    it('should default page to 1 when only ?limit is provided', async () => {
      for (let i = 1; i <= 5; i++) {
        taskService.create({ title: `Task ${i}` });
      }

      const res = await request(app).get('/tasks?limit=3');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
      expect(res.body[0].title).toBe('Task 1');
    });


    // Edge Case: pagination page beyond total tasks
    it('should return empty array when requesting a page beyond available tasks', async () => {
      taskService.create({ title: 'Task 1' });

      const res = await request(app).get('/tasks?page=99&limit=10');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('GET /tasks/stats', () => {
    it('should return initial zero counts when no tasks exist', async () => {
      const res = await request(app).get('/tasks/stats');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        todo: 0,
        in_progress: 0,
        done: 0,
        overdue: 0,
      });
    });

    // Edge Case: Overdue calculation ignores completed tasks even if dueDate is in the past
    it('should return accurate stats including overdue count for non-done tasks', async () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString(); // 1 day ago
      const futureDate = new Date(Date.now() + 86400000).toISOString(); // 1 day in future

      taskService.create({ title: 'Overdue Todo', status: 'todo', dueDate: pastDate });
      taskService.create({ title: 'Active Future', status: 'in_progress', dueDate: futureDate });
      taskService.create({ title: 'Completed Past', status: 'done', dueDate: pastDate });

      const res = await request(app).get('/tasks/stats');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        todo: 1,
        in_progress: 1,
        done: 1,
        overdue: 1, // Only the 'todo' task is overdue; 'done' is excluded
      });
    });
  });

  describe('POST /tasks', () => {
    it('should create a new task with status 201 and default fields', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'Buy groceries' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toBe('Buy groceries');
      expect(res.body.description).toBe('');
      expect(res.body.status).toBe('todo');
      expect(res.body.priority).toBe('medium');
      expect(res.body.dueDate).toBeNull();
      expect(res.body.completedAt).toBeNull();
      expect(res.body).toHaveProperty('createdAt');
    });

    it('should create a task with all valid custom fields', async () => {
      const payload = {
        title: 'Complete project',
        description: 'Prepare tests and code',
        status: 'in_progress',
        priority: 'high',
        dueDate: '2026-12-31T18:00:00.000Z',
      };

      const res = await request(app).post('/tasks').send(payload);

      expect(res.status).toBe(201);
      expect(res.body.title).toBe(payload.title);
      expect(res.body.description).toBe(payload.description);
      expect(res.body.status).toBe('in_progress');
      expect(res.body.priority).toBe('high');
      expect(res.body.dueDate).toBe(payload.dueDate);
    });

    // Edge Cases: validation failures
    it('should return 400 if title is missing', async () => {
      const res = await request(app).post('/tasks').send({});
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 400 if title is empty or whitespace-only', async () => {
      const res = await request(app).post('/tasks').send({ title: '    ' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 400 if status is invalid', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'Task', status: 'invalid_status' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('status must be one of');
    });

    it('should return 400 if priority is invalid', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'Task', priority: 'urgent' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('priority must be one of');
    });

    it('should return 400 if dueDate is not a valid date string', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'Task', dueDate: 'invalid-date' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('dueDate must be a valid ISO date string');
    });
  });

  describe('PUT /tasks/:id', () => {
    it('should update an existing task and return 200', async () => {
      const task = taskService.create({ title: 'Old Title', priority: 'low' });

      const res = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ title: 'New Title', priority: 'high' });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('New Title');
      expect(res.body.priority).toBe('high');
    });

    // Edge Case: 404 for nonexistent ID
    it('should return 404 if task ID does not exist', async () => {
      const res = await request(app)
        .put('/tasks/00000000-0000-0000-0000-000000000000')
        .send({ title: 'Updated' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Task not found' });
    });

    it('should return 400 if update payload contains invalid data', async () => {
      const task = taskService.create({ title: 'Valid Task' });

      const res = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ priority: 'super-urgent' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('priority must be one of');
    });
  });

  describe('DELETE /tasks/:id', () => {
    it('should delete an existing task and return 204 No Content', async () => {
      const task = taskService.create({ title: 'Delete Me' });

      const res = await request(app).delete(`/tasks/${task.id}`);
      expect(res.status).toBe(204);
      expect(res.text).toBe('');

      expect(taskService.findById(task.id)).toBeUndefined();
    });

    // Edge Case: 404 for nonexistent ID
    it('should return 404 when deleting a nonexistent task', async () => {
      const res = await request(app).delete('/tasks/nonexistent-id');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Task not found' });
    });
  });

  describe('PATCH /tasks/:id/complete', () => {
    it('should mark task as completed and set completedAt timestamp', async () => {
      const task = taskService.create({ title: 'Complete Me', priority: 'high' });

      const res = await request(app).patch(`/tasks/${task.id}/complete`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('done');
      expect(res.body.completedAt).toBeDefined();
      expect(new Date(res.body.completedAt).getTime()).not.toBeNaN();
    });

    // Edge Case: 404 for nonexistent ID
    it('should return 404 when completing a nonexistent task', async () => {
      const res = await request(app).patch('/tasks/nonexistent-id/complete');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Task not found' });
    });
  });

  describe('PATCH /tasks/:id/assign', () => {
    // 1. Successful assignment
    it('should assign a task to a user and return 200 with updated task', async () => {
      const task = taskService.create({ title: 'Task to assign' });

      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: 'Alice' });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(task.id);
      expect(res.body.assignee).toBe('Alice');
      expect(res.body.title).toBe('Task to assign');
      expect(res.body.status).toBe('todo');
    });

    // 2. Nonexistent task
    it('should return 404 if the task does not exist', async () => {
      const res = await request(app)
        .patch('/tasks/nonexistent-task-id/assign')
        .send({ assignee: 'Alice' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Task not found' });
    });

    // 3. Missing assignee
    it('should return 400 if assignee field is missing from request body', async () => {
      const task = taskService.create({ title: 'Task' });

      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('assignee is required and must be a non-empty string');
    });

    // 4. Empty assignee
    it('should return 400 if assignee is an empty string', async () => {
      const task = taskService.create({ title: 'Task' });

      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: '' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('assignee is required and must be a non-empty string');
    });

    // 5. Whitespace-only assignee
    it('should return 400 if assignee is whitespace only', async () => {
      const task = taskService.create({ title: 'Task' });

      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: '     ' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('assignee is required and must be a non-empty string');
    });

    it('should return 400 if assignee is not a string type', async () => {
      const task = taskService.create({ title: 'Task' });

      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: 12345 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('assignee is required and must be a non-empty string');
    });

    // 6. Already-assigned task according to the chosen documented behavior (reassignment)
    it('should allow reassigning a task that already has an assignee and return 200', async () => {
      const task = taskService.create({ title: 'Reassignable Task' });

      // First assignment
      await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: 'Alice' });

      // Reassignment
      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: 'Bob' });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(task.id);
      expect(res.body.assignee).toBe('Bob');
    });
  });
});

