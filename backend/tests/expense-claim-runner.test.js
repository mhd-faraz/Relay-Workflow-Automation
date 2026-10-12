jest.mock('../src/models/Approval', () => ({
  findOne: jest.fn(),
}));

jest.mock('../src/models/ExpenseClaim', () => ({
  findOneAndUpdate: jest.fn(),
}));

const Approval = require('../src/models/Approval');
const ExpenseClaim = require('../src/models/ExpenseClaim');
const { runExpenseClaim, runApprovalNode } = require('../src/engine/nodeRunners');

const config = {
  nodeId: 'expense-save-record',
  approvalNodeId: 'expense-manager-approval',
  autoApprovalLimit: 5000,
  fields: {
    claimReference: '{{claimReference}}',
    employeeName: '{{employeeName}}',
    department: '{{department}}',
    category: '{{category}}',
    description: '{{description}}',
    amount: '{{amount}}',
  },
};

const input = {
  claimReference: 'EXP-2026-0071',
  employeeName: 'Aarav Sharma',
  department: 'Engineering',
  category: 'Software',
  description: 'Monitoring subscription',
  amount: 12500,
};

describe('expense claim workflow node', () => {
  beforeEach(() => jest.clearAllMocks());

  test('persists an approved claim with the reviewer and returns the ledger record ID', async () => {
    Approval.findOne.mockResolvedValue({
      status: 'approved',
      resolvedBy: 'manager@example.com',
      resolvedAt: new Date('2026-10-12T10:00:00Z'),
    });
    ExpenseClaim.findOneAndUpdate.mockResolvedValue({
      _id: { toString: () => 'ledger-record-123' },
      claimReference: input.claimReference,
      status: 'approved',
      amount: input.amount,
      currency: 'INR',
      approvedBy: 'manager@example.com',
      createdAt: new Date('2026-10-12T10:00:00Z'),
    });

    const result = await runExpenseClaim(config, input, {
      runId: 'run-123',
      userId: 'user-456',
    });

    expect(Approval.findOne).toHaveBeenCalledWith({
      runId: 'run-123',
      nodeId: 'expense-manager-approval',
    });
    expect(ExpenseClaim.findOneAndUpdate).toHaveBeenCalledWith(
      { runId: 'run-123', nodeId: 'expense-save-record' },
      {
        $setOnInsert: expect.objectContaining({
          runId: 'run-123',
          userId: 'user-456',
          claimReference: input.claimReference,
          status: 'approved',
          approvedBy: 'manager@example.com',
          currency: 'INR',
        }),
      },
      { new: true, upsert: true, runValidators: true }
    );
    expect(result.expenseClaim.recordId).toBe('ledger-record-123');
  });

  test('auto-approves claims within policy limit and persists them', async () => {
    Approval.findOne.mockResolvedValue(null);
    ExpenseClaim.findOneAndUpdate.mockResolvedValue({
      _id: { toString: () => 'ledger-record-456' },
      claimReference: input.claimReference,
      status: 'auto_approved',
      amount: 2500,
      currency: 'INR',
      approvedBy: null,
      createdAt: new Date(),
    });

    const result = await runExpenseClaim(config, { ...input, amount: 2500 }, {
      runId: 'run-789',
      userId: 'user-456',
    });

    expect(ExpenseClaim.findOneAndUpdate.mock.calls[0][1].$setOnInsert.status)
      .toBe('auto_approved');
    expect(result.expenseClaim.status).toBe('auto_approved');
  });

  test('refuses to record high-value claims without approval', async () => {
    Approval.findOne.mockResolvedValue(null);

    await expect(runExpenseClaim(config, input, {
      runId: 'run-123',
      userId: 'user-456',
    })).rejects.toThrow('require manager approval');
    expect(ExpenseClaim.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('refuses rejected claims', async () => {
    Approval.findOne.mockResolvedValue({ status: 'rejected' });

    await expect(runExpenseClaim(config, input, {
      runId: 'run-123',
      userId: 'user-456',
    })).rejects.toThrow('Rejected expense claim');
    expect(ExpenseClaim.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('rejects duplicate claim references with an actionable error', async () => {
    Approval.findOne.mockResolvedValue(null);
    ExpenseClaim.findOneAndUpdate.mockRejectedValue({
      code: 11000,
      keyPattern: { userId: 1, claimReference: 1 },
    });

    await expect(runExpenseClaim(config, { ...input, amount: 2500 }, {
      runId: 'run-duplicate',
      userId: 'user-456',
    })).rejects.toThrow('EXP-2026-0071" has already been used');
  });

  test('returns reviewer details from an approved approval node', async () => {
    const approval = {
      status: 'approved',
      resolvedBy: 'manager@example.com',
    };
    const model = { findOne: jest.fn().mockResolvedValue(approval) };

    await expect(runApprovalNode({}, 'run-123', 'approval-1', 'Manager Approval', {}, model))
      .resolves.toEqual({
        approval: { approved: true, resolvedBy: 'manager@example.com' },
      });
  });
});
