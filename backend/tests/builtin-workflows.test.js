jest.mock('../src/models/Workflow', () => ({
  bulkWrite: jest.fn().mockResolvedValue({}),
  deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
  find: jest.fn(),
}));

const Workflow = require('../src/models/Workflow');
const { upsertBuiltinWorkflows } = require('../seeds/demoWorkflows');

describe('built-in workflows', () => {
  beforeEach(() => jest.clearAllMocks());

  test('removes the email template and upserts six shared workflows without deleting run history', async () => {
    const workflows = [{ name: 'Purchase Request Approval' }];
    Workflow.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue(workflows),
    });

    await expect(upsertBuiltinWorkflows()).resolves.toEqual(workflows);

    expect(Workflow.deleteOne).toHaveBeenCalledWith({
      name: 'Approval-Gated Email Notification',
      userId: null,
      isTemplate: true,
    });

    const [operations] = Workflow.bulkWrite.mock.calls[0];
    const names = operations.map((operation) => operation.updateOne.update.$set.name);
    expect(names).toEqual(expect.arrayContaining([
      'GitHub Repository Health Check',
      'Purchase Request Approval',
      'Production Incident Escalation',
      'E-Commerce Order Processing',
      'Support Ticket Router',
      'Employee Expense Reimbursement',
    ]));
    expect(operations).toHaveLength(6);
    expect(new Set(names).size).toBe(6);
    const definitions = new Map();
    for (const operation of operations) {
      expect(operation.updateOne.filter).toEqual({
        name: operation.updateOne.update.$set.name,
        userId: null,
      });
      expect(operation.updateOne.update.$set).toMatchObject({
        isTemplate: true,
        status: 'published',
      });
      expect(operation.updateOne.update.$set.publishedDefinition).toMatchObject({
        entryNodeId: expect.any(String),
        nodes: expect.any(Array),
      });
      definitions.set(
        operation.updateOne.update.$set.name,
        operation.updateOne.update.$set.publishedDefinition
      );
    }
    for (const [name, definition] of definitions) {
      const nodeIds = new Set(definition.nodes.map((node) => node.id));
      expect(nodeIds.has(definition.entryNodeId)).toBe(true);
      for (const node of definition.nodes) {
        const targets = node.type === 'condition'
          ? [node.onTrue, node.onFalse].filter(Boolean)
          : node.next || [];
        for (const target of targets) expect(nodeIds.has(target)).toBe(true);
      }
      if (name !== 'GitHub Repository Health Check') {
        expect(definition.nodes.some((node) => node.type === 'approval')).toBe(true);
      }
      if (name === 'Employee Expense Reimbursement') {
        expect(definition.nodes.some((node) => node.type === 'expense_claim')).toBe(true);
        expect(definition.inputSchema.fields.amount).toMatchObject({
          type: 'number',
          min: 0.01,
          max: 1000000,
        });
      }
    }
    expect(Workflow.find).toHaveBeenCalledWith({
      name: { $in: names },
      isTemplate: true,
    });
  });
});
