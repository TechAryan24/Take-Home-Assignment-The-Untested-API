const { validateCreateTask, validateUpdateTask, validateAssignTask } = require('../../src/utils/validators');

describe('validators (Unit Tests)', () => {

  describe('validateCreateTask', () => {
    it('should return null for valid task input', () => {
      const error = validateCreateTask({
        title: 'Valid Task',
        description: 'A description',
        status: 'todo',
        priority: 'high',
        dueDate: '2026-12-31T23:59:59.000Z',
      });
      expect(error).toBeNull();
    });

    it('should return null when optional fields are omitted', () => {
      const error = validateCreateTask({
        title: 'Only Title',
      });
      expect(error).toBeNull();
    });

    it('should return error if title is missing', () => {
      const error = validateCreateTask({});
      expect(error).toBe('title is required and must be a non-empty string');
    });

    it('should return error if title is not a string', () => {
      const error = validateCreateTask({ title: 12345 });
      expect(error).toBe('title is required and must be a non-empty string');
    });

    it('should return error if title is empty string', () => {
      const error = validateCreateTask({ title: '' });
      expect(error).toBe('title is required and must be a non-empty string');
    });

    it('should return error if title is whitespace only', () => {
      const error = validateCreateTask({ title: '    ' });
      expect(error).toBe('title is required and must be a non-empty string');
    });

    it('should return error if status is invalid', () => {
      const error = validateCreateTask({
        title: 'Task',
        status: 'invalid_status',
      });
      expect(error).toBe('status must be one of: todo, in_progress, done');
    });

    it('should return error if priority is invalid', () => {
      const error = validateCreateTask({
        title: 'Task',
        priority: 'urgent',
      });
      expect(error).toBe('priority must be one of: low, medium, high');
    });

    it('should return error if dueDate is not a valid date string', () => {
      const error = validateCreateTask({
        title: 'Task',
        dueDate: 'not-a-valid-date',
      });
      expect(error).toBe('dueDate must be a valid ISO date string');
    });
  });

  describe('validateUpdateTask', () => {
    it('should return null for valid partial updates', () => {
      expect(validateUpdateTask({ title: 'Updated' })).toBeNull();
      expect(validateUpdateTask({ status: 'done' })).toBeNull();
      expect(validateUpdateTask({ priority: 'low' })).toBeNull();
      expect(validateUpdateTask({ dueDate: '2026-10-15T12:00:00.000Z' })).toBeNull();
    });

    it('should return null for empty body object', () => {
      expect(validateUpdateTask({})).toBeNull();
    });

    it('should return error if updated title is empty string', () => {
      const error = validateUpdateTask({ title: '' });
      expect(error).toBe('title must be a non-empty string');
    });

    it('should return error if updated title is whitespace only', () => {
      const error = validateUpdateTask({ title: '   ' });
      expect(error).toBe('title must be a non-empty string');
    });

    it('should return error if updated title is non-string', () => {
      const error = validateUpdateTask({ title: 999 });
      expect(error).toBe('title must be a non-empty string');
    });

    it('should return error if updated status is invalid', () => {
      const error = validateUpdateTask({ status: 'pending' });
      expect(error).toBe('status must be one of: todo, in_progress, done');
    });

    it('should return error if updated priority is invalid', () => {
      const error = validateUpdateTask({ priority: 'critical' });
      expect(error).toBe('priority must be one of: low, medium, high');
    });

    it('should return error if updated dueDate is not valid', () => {
      const error = validateUpdateTask({ dueDate: 'invalid-date' });
      expect(error).toBe('dueDate must be a valid ISO date string');
    });
  });

  describe('validateAssignTask', () => {
    it('should return null for valid string assignee', () => {
      expect(validateAssignTask({ assignee: 'Alice' })).toBeNull();
    });

    it('should return error if body is missing or null', () => {
      expect(validateAssignTask(null)).toBe('assignee is required and must be a non-empty string');
      expect(validateAssignTask(undefined)).toBe('assignee is required and must be a non-empty string');
    });

    it('should return error if assignee is missing', () => {
      expect(validateAssignTask({})).toBe('assignee is required and must be a non-empty string');
    });

    it('should return error if assignee is not a string', () => {
      expect(validateAssignTask({ assignee: 123 })).toBe('assignee is required and must be a non-empty string');
      expect(validateAssignTask({ assignee: true })).toBe('assignee is required and must be a non-empty string');
      expect(validateAssignTask({ assignee: {} })).toBe('assignee is required and must be a non-empty string');
    });

    it('should return error if assignee is empty string', () => {
      expect(validateAssignTask({ assignee: '' })).toBe('assignee is required and must be a non-empty string');
    });

    it('should return error if assignee is whitespace only', () => {
      expect(validateAssignTask({ assignee: '   ' })).toBe('assignee is required and must be a non-empty string');
    });
  });
});

