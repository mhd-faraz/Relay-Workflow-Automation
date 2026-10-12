jest.mock('../src/models/Run', () => ({ findOne: jest.fn() }));
jest.mock('../src/models/Step', () => ({ deleteMany: jest.fn() }));
jest.mock('../src/models/Approval', () => ({ deleteMany: jest.fn() }));
jest.mock('../src/workers/workflowWorker', () => ({ getQueue: jest.fn() }));

const Run = require('../src/models/Run');
const Step = require('../src/models/Step');
const Approval = require('../src/models/Approval');
const { deleteFailedRun, validateWorkflowInput } = require('../src/controllers/run.controller');

const makeResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('deleteFailedRun', () => {
  beforeEach(() => jest.clearAllMocks());

  test('deletes only an owned failed run and its trace records', async () => {
    const run = { _id: 'run-123', deleteOne: jest.fn().mockResolvedValue({}) };
    Run.findOne.mockResolvedValue(run);
    Step.deleteMany.mockResolvedValue({});
    Approval.deleteMany.mockResolvedValue({});
    const req = { params: { id: 'run-123' }, userId: 'user-456' };
    const res = makeResponse();

    await deleteFailedRun(req, res);

    expect(Run.findOne).toHaveBeenCalledWith({
      _id: 'run-123',
      userId: 'user-456',
      status: 'failed',
    });

    expect(Step.deleteMany).toHaveBeenCalledWith({ runId: 'run-123' });
    expect(Approval.deleteMany).toHaveBeenCalledWith({ runId: 'run-123' });
    expect(run.deleteOne).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Failed run deleted' });
  });

  test('does not delete a run that is not failed or owned by the user', async () => {
    Run.findOne.mockResolvedValue(null);
    const req = { params: { id: 'run-123' }, userId: 'user-456' };
    const res = makeResponse();

    await deleteFailedRun(req, res);

    expect(Step.deleteMany).not.toHaveBeenCalled();
    expect(Approval.deleteMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Failed run not found' });
  });
});

describe('validateWorkflowInput', () => {
  const ecommerce = { name: 'E-Commerce Order Processing' };
  const ticketRouter = { name: 'Support Ticket Router' };

  test('requires order ID and numeric amount for e-commerce, including legacy workflows', () => {
    expect(validateWorkflowInput({}, {}, ecommerce)).toBe('Input field "orderId" is required');
    expect(validateWorkflowInput({}, { orderId: 'ORD-1', amount: '25000' }, ecommerce))
      .toBe('Input field "amount" must be a number');
    expect(validateWorkflowInput({}, { orderId: 'ORD-1', amount: 25000 }, ecommerce)).toBeNull();
  });

  test('requires a non-empty support ticket message', () => {
    expect(validateWorkflowInput({}, { message: '  ' }, ticketRouter))
      .toBe('Input field "message" is required');
    expect(validateWorkflowInput({}, { message: 'Production outage' }, ticketRouter)).toBeNull();
  });

  test('validates schemas embedded in published workflow definitions', () => {
    const definition = {
      inputSchema: { fields: { amount: { type: 'number', required: true } } },
    };
    expect(validateWorkflowInput(definition, { amount: 25000 })).toBeNull();
    expect(validateWorkflowInput(definition, { amount: null })).toBe('Input field "amount" is required');
  });

  test('validates GitHub owner/repository names before using them in API URLs', () => {
    const github = {
      name: 'GitHub Repository Health Check',
      inputSchema: {
        fields: {
          owner: {
            type: 'string',
            required: true,
            validator: 'githubOwner',
          },
          repo: { type: 'string', required: true, validator: 'githubRepo' },
        },
      },
    };

    expect(validateWorkflowInput({}, { owner: 'octo-org', repo: 'sample_repo.js' }, github)).toBeNull();
    expect(validateWorkflowInput({}, { owner: 'bad/owner', repo: 'repo' }, github))
      .toBe('Input field "owner" must be in the correct format');
    expect(validateWorkflowInput({}, { owner: 'octo-org', repo: '../other' }, github))
      .toBe('Input field "repo" must be in the correct format');
  });

  test('rejects severities outside the supported incident levels', () => {
    const incident = {
      inputSchema: {
        fields: {
          severity: { type: 'string', required: true, enum: ['critical', 'high', 'medium', 'low'] },
        },
      },
    };
    expect(validateWorkflowInput(incident, { severity: 'urgent' })).toBe(
      'Input field "severity" must be one of: critical, high, medium, low'
    );
    expect(validateWorkflowInput(incident, { severity: 'critical' })).toBeNull();
  });

  test('validates required expense claim fields, category, and amount range', () => {
    const expense = { name: 'Employee Expense Reimbursement' };
    const validClaim = {
      claimReference: 'EXP-2026-0071',
      employeeName: 'Aarav Sharma',
      department: 'Engineering',
      category: 'Software',
      description: 'Monitoring subscription',
      amount: 12500,
    };

    expect(validateWorkflowInput({}, validClaim, expense)).toBeNull();
    expect(validateWorkflowInput({}, { ...validClaim, amount: 0 }, expense))
      .toBe('Input field "amount" must be at least 0.01');
    expect(validateWorkflowInput({}, { ...validClaim, amount: 1000001 }, expense))
      .toBe('Input field "amount" must be at most 1000000');
    expect(validateWorkflowInput({}, { ...validClaim, category: 'Otherish' }, expense))
      .toMatch(/category.*must be one of/i);
  });
});
