jest.mock('../src/models/Approval', () => ({
  findById: jest.fn(),
}));

jest.mock('../src/models/Run', () => ({
  find: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));

jest.mock('../src/models/User', () => ({
  findById: jest.fn(),
}));

jest.mock('../src/workers/workflowWorker', () => ({
  getQueue: jest.fn(),
}));

const Approval = require('../src/models/Approval');
const Run = require('../src/models/Run');
const User = require('../src/models/User');
const { getQueue } = require('../src/workers/workflowWorker');
const { resolveApproval } = require('../src/controllers/approval.controller');

const makeResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('resolveApproval', () => {
  beforeEach(() => jest.clearAllMocks());

  test('records the authenticated reviewer rather than a client-provided identity', async () => {
    const approval = {
      status: 'pending',
      runId: {
        _id: 'run-123',
        userId: 'user-123',
      },
      nodeName: 'Manager Expense Approval',
      save: jest.fn().mockResolvedValue(undefined),
    };
    Approval.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue(approval),
    });
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ email: 'reviewer@example.com' }),
    });
    Run.findByIdAndUpdate.mockResolvedValue({});
    const queue = { add: jest.fn().mockResolvedValue({}) };
    getQueue.mockReturnValue(queue);
    const req = {
      params: { id: 'approval-123' },
      userId: 'user-123',
      body: {
        action: 'approved',
        resolvedBy: 'forged@example.com',
        comment: 'Reviewed and approved.',
      },
    };
    const res = makeResponse();

    await resolveApproval(req, res);

    expect(approval.resolvedBy).toBe('reviewer@example.com');
    expect(approval.comment).toBe('Reviewed and approved.');
    expect(approval.save).toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      message: 'Approved and run resumed',
    }));
  });
});
