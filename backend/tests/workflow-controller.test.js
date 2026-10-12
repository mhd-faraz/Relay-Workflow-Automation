jest.mock('../src/models/Workflow', () => ({
  find: jest.fn(),
}));

jest.mock('../seeds/demoWorkflows', () => ({
  upsertBuiltinWorkflows: jest.fn(),
  BUILTIN_WORKFLOW_NAMES: [
    'GitHub Repository Health Check',
    'Purchase Request Approval',
    'Production Incident Escalation',
    'E-Commerce Order Processing',
    'Support Ticket Router',
    'Employee Expense Reimbursement',
  ],
}));

const Workflow = require('../src/models/Workflow');
const { upsertBuiltinWorkflows } = require('../seeds/demoWorkflows');
const { listWorkflows } = require('../src/controllers/workflow.controller');

const makeResponse = () => {
  const res = {};
  res.json = jest.fn().mockReturnValue(res);
  res.status = jest.fn().mockReturnValue(res);
  return res;
};

const mockFindResult = (workflows) => ({
  sort: jest.fn().mockResolvedValue(workflows),
});

describe('listWorkflows', () => {
  beforeEach(() => jest.clearAllMocks());

  test('restores missing shared built-ins before returning workflows', async () => {
    const templates = [
      { name: 'GitHub Repository Health Check', isTemplate: true },
      { name: 'Purchase Request Approval', isTemplate: true },
      { name: 'Production Incident Escalation', isTemplate: true },
      { name: 'E-Commerce Order Processing', isTemplate: true },
      { name: 'Support Ticket Router', isTemplate: true },
      { name: 'Employee Expense Reimbursement', isTemplate: true },
    ];
    Workflow.find
      .mockReturnValueOnce(mockFindResult([]))
      .mockReturnValueOnce(mockFindResult(templates));

    const req = { query: {}, userId: 'user-123' };
    const res = makeResponse();
    await listWorkflows(req, res);

    expect(upsertBuiltinWorkflows).toHaveBeenCalledTimes(1);
    expect(Workflow.find).toHaveBeenCalledTimes(2);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: templates });
  });

  test('does not reprovision built-ins when all shared templates are present', async () => {
    const templates = [
      { name: 'GitHub Repository Health Check', isTemplate: true },
      { name: 'Purchase Request Approval', isTemplate: true },
      { name: 'Production Incident Escalation', isTemplate: true },
      { name: 'E-Commerce Order Processing', isTemplate: true },
      { name: 'Support Ticket Router', isTemplate: true },
      { name: 'Employee Expense Reimbursement', isTemplate: true },
    ];
    Workflow.find.mockReturnValueOnce(mockFindResult(templates));

    const req = { query: {}, userId: 'user-123' };
    const res = makeResponse();
    await listWorkflows(req, res);

    expect(upsertBuiltinWorkflows).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true, data: templates });
  });
});
