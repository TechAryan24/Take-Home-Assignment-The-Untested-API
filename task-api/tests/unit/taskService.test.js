const taskService = require('../../src/services/taskService');

describe('taskService (Unit Tests)', () => {
  beforeEach(() => {
    taskService._reset();
  });

  describe('create and getAll', () => {
    it('should create a task with default values and store it', () => {
      const task = taskService.create({ title: 'Test Task' });

      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.title).toBe('Test Task');
      expect(task.description).toBe('');
      expect(task.status).toBe('todo');
      expect(task.priority).toBe('medium');
      expect(task.dueDate).toBeNull();
      expect(task.completedAt).toBeNull();
      expect(typeof task.createdAt).toBe('string');

      const all = taskService.getAll();
      expect(all).toHaveLength(1);
      expect(all[0]).toEqual(task);
    });

    it('should create a task with custom values', () => {
      const task = taskService.create({
        title: 'Custom Task',
        description: 'Details here',
        status: 'in_progress',
        priority: 'high',
        dueDate: '2026-12-31T23:59:59.000Z',
      });

      expect(task.title).toBe('Custom Task');
      expect(task.description).toBe('Details here');
      expect(task.status).toBe('in_progress');
      expect(task.priority).toBe('high');
      expect(task.dueDate).toBe('2026-12-31T23:59:59.000Z');
    });

    it('getAll should return a copy of the tasks array', () => {
      taskService.create({ title: 'Task 1' });
      const list1 = taskService.getAll();
      const list2 = taskService.getAll();

      expect(list1).toEqual(list2);
      expect(list1).not.toBe(list2);
    });
  });

  describe('findById', () => {
    it('should return the task if found by ID', () => {
      const created = taskService.create({ title: 'Find Me' });
      const found = taskService.findById(created.id);

      expect(found).toBeDefined();
      expect(found.id).toBe(created.id);
      expect(found.title).toBe('Find Me');
    });

    it('should return undefined when task ID does not exist', () => {
      const found = taskService.findById('non-existent-id');
      expect(found).toBeUndefined();
    });
  });

  describe('getByStatus', () => {
    it('should filter tasks by status', () => {
      taskService.create({ title: 'Task 1', status: 'todo' });
      taskService.create({ title: 'Task 2', status: 'in_progress' });
      taskService.create({ title: 'Task 3', status: 'done' });

      const todos = taskService.getByStatus('todo');
      expect(todos).toHaveLength(1);
      expect(todos[0].title).toBe('Task 1');

      const inProgress = taskService.getByStatus('in_progress');
      expect(inProgress).toHaveLength(1);
      expect(inProgress[0].title).toBe('Task 2');

      const doneTasks = taskService.getByStatus('done');
      expect(doneTasks).toHaveLength(1);
      expect(doneTasks[0].title).toBe('Task 3');
    });

    it('should return empty array if no tasks match status', () => {
      taskService.create({ title: 'Task 1', status: 'todo' });
      const results = taskService.getByStatus('non_existent_status');
      expect(results).toEqual([]);
    });
  });

  describe('getPaginated', () => {
    it('should return the correct slice of tasks for page 1 and page 2', () => {
      for (let i = 1; i <= 5; i++) {
        taskService.create({ title: `Task ${i}` });
      }

      // Page 1 with limit 2 should return Task 1, Task 2
      const page1 = taskService.getPaginated(1, 2);
      expect(page1).toHaveLength(2);
      expect(page1[0].title).toBe('Task 1');
      expect(page1[1].title).toBe('Task 2');

      // Page 2 with limit 2 should return Task 3, Task 4
      const page2 = taskService.getPaginated(2, 2);
      expect(page2).toHaveLength(2);
      expect(page2[0].title).toBe('Task 3');
      expect(page2[1].title).toBe('Task 4');
    });

    it('should return empty array if page is beyond available items', () => {
      taskService.create({ title: 'Task 1' });
      const page10 = taskService.getPaginated(10, 5);
      expect(page10).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('should return correct status counts and overdue count', () => {
      const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(); // 1 day ago
      const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(); // 1 day in future

      // Overdue: status todo, past due date
      taskService.create({ title: 'Overdue Todo', status: 'todo', dueDate: pastDate });
      // Overdue: status in_progress, past due date
      taskService.create({ title: 'Overdue In Progress', status: 'in_progress', dueDate: pastDate });
      // NOT Overdue: status done with past due date
      taskService.create({ title: 'Completed Past Due', status: 'done', dueDate: pastDate });
      // NOT Overdue: status todo with future due date
      taskService.create({ title: 'Future Todo', status: 'todo', dueDate: futureDate });
      // NOT Overdue: status todo with no due date
      taskService.create({ title: 'No Due Date Todo', status: 'todo', dueDate: null });

      const stats = taskService.getStats();
      expect(stats.todo).toBe(3);
      expect(stats.in_progress).toBe(1);
      expect(stats.done).toBe(1);
      expect(stats.overdue).toBe(2);
    });

    it('should handle tasks with unrecognized status gracefully in stats', () => {
      taskService.create({ title: 'Task Unknown', status: 'unknown_status' });
      const stats = taskService.getStats();
      expect(stats.todo).toBe(0);
      expect(stats.in_progress).toBe(0);
      expect(stats.done).toBe(0);
      expect(stats.overdue).toBe(0);
    });

    it('should return all zeros when there are no tasks', () => {

      const stats = taskService.getStats();
      expect(stats).toEqual({
        todo: 0,
        in_progress: 0,
        done: 0,
        overdue: 0,
      });
    });
  });

  describe('update', () => {
    it('should update task fields successfully', () => {
      const created = taskService.create({ title: 'Original Title', priority: 'low' });
      const updated = taskService.update(created.id, {
        title: 'New Title',
        priority: 'high',
      });

      expect(updated).toBeDefined();
      expect(updated.id).toBe(created.id);
      expect(updated.title).toBe('New Title');
      expect(updated.priority).toBe('high');

      const found = taskService.findById(created.id);
      expect(found.title).toBe('New Title');
    });

    it('should return null when updating nonexistent task ID', () => {
      const result = taskService.update('non-existent-id', { title: 'New' });
      expect(result).toBeNull();
    });
  });

  describe('remove', () => {
    it('should remove existing task and return true', () => {
      const created = taskService.create({ title: 'To Delete' });
      const removed = taskService.remove(created.id);

      expect(removed).toBe(true);
      expect(taskService.findById(created.id)).toBeUndefined();
      expect(taskService.getAll()).toHaveLength(0);
    });

    it('should return false when removing nonexistent task ID', () => {
      const removed = taskService.remove('non-existent-id');
      expect(removed).toBe(false);
    });
  });

  describe('completeTask', () => {
    it('should mark task as done and set completedAt', () => {
      const created = taskService.create({ title: 'Finish Homework', priority: 'high' });
      const completed = taskService.completeTask(created.id);

      expect(completed).toBeDefined();
      expect(completed.id).toBe(created.id);
      expect(completed.status).toBe('done');
      expect(typeof completed.completedAt).toBe('string');
      expect(new Date(completed.completedAt).getTime()).not.toBeNaN();
    });

    it('should return null when completing nonexistent task ID', () => {
      const result = taskService.completeTask('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('assignTask', () => {
    it('should assign a user to a task and trim whitespace', () => {
      const task = taskService.create({ title: 'Task to assign' });
      const assigned = taskService.assignTask(task.id, '  John Doe  ');

      expect(assigned).toBeDefined();
      expect(assigned.id).toBe(task.id);
      expect(assigned.assignee).toBe('John Doe');
      expect(assigned.title).toBe('Task to assign');

      const found = taskService.findById(task.id);
      expect(found.assignee).toBe('John Doe');
    });

    it('should reassign a task that already has an assignee', () => {
      const task = taskService.create({ title: 'Task with assignee' });
      taskService.assignTask(task.id, 'Alice');

      const reassigned = taskService.assignTask(task.id, 'Bob');
      expect(reassigned.assignee).toBe('Bob');

      const found = taskService.findById(task.id);
      expect(found.assignee).toBe('Bob');
    });

    it('should return null when assigning nonexistent task ID', () => {
      const result = taskService.assignTask('non-existent-id', 'Alice');
      expect(result).toBeNull();
    });
  });

  describe('_reset', () => {

    it('should empty all stored tasks', () => {
      taskService.create({ title: 'Task 1' });
      taskService.create({ title: 'Task 2' });
      expect(taskService.getAll()).toHaveLength(2);

      taskService._reset();
      expect(taskService.getAll()).toHaveLength(0);
    });
  });
});
