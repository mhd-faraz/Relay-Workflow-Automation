import { Sparkles, GitBranch, Globe, Clock, Bell, CheckSquare, Play, Mail } from 'lucide-react';

export const NODE_TYPES = {
  trigger: {
    label: 'Trigger',
    icon: Play,
    color: '#8888aa',
    bg: '#8888aa20',
    description: 'Start of the workflow',
    fields: [],
    defaultConfig: {},
  },
  ai: {
    label: 'AI Decision',
    icon: Sparkles,
    color: '#a78bfa',
    bg: '#a78bfa20',
    description: 'Ask AI to analyze and decide',
    fields: [
      { key: 'prompt', label: 'Prompt', type: 'textarea', placeholder: 'Analyze this: {{payload}}. Respond with JSON only: { ... }' },
      { key: 'outputSchema', label: 'Output Schema (JSON)', type: 'json', placeholder: '{ "field": { "type": "string", "required": true } }' },
    ],
    defaultConfig: {
      prompt: 'Analyze this input and respond with JSON only:\n{{payload}}\n\nRespond with: { "result": "string" }',
      outputSchema: { result: { type: 'string', required: true } },
    },
  },
  condition: {
    label: 'Condition',
    icon: GitBranch,
    color: '#f59e0b',
    bg: '#f59e0b20',
    description: 'Branch based on a value',
    fields: [
      { key: 'field', label: 'Field to check', type: 'text', placeholder: 'parsed.someField' },
      { key: 'operator', label: 'Operator', type: 'select', options: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'contains', 'exists'] },
      { key: 'value', label: 'Compare value', type: 'text', placeholder: 'true' },
    ],
    defaultConfig: { field: '', operator: 'eq', value: '' },
  },
  http_request: {
    label: 'HTTP Request',
    icon: Globe,
    color: '#3b82f6',
    bg: '#3b82f620',
    description: 'Call an external API',
    fields: [
      { key: 'url', label: 'URL', type: 'text', placeholder: 'https://api.example.com/endpoint' },
      { key: 'method', label: 'Method', type: 'select', options: ['GET', 'POST', 'PUT', 'DELETE'] },
      { key: 'body', label: 'Body (JSON)', type: 'json', placeholder: '{ "key": "{{payload.value}}" }' },
    ],
    defaultConfig: { url: '', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: {} },
  },
  delay: {
    label: 'Delay',
    icon: Clock,
    color: '#06b6d4',
    bg: '#06b6d420',
    description: 'Wait before continuing',
    fields: [
      { key: 'durationMs', label: 'Duration (ms)', type: 'number', placeholder: '2000' },
    ],
    defaultConfig: { durationMs: 2000 },
  },
  notify: {
    label: 'Notify',
    icon: Bell,
    color: '#22c55e',
    bg: '#22c55e20',
    description: 'Send a notification',
    fields: [
      { key: 'channel', label: 'Channel', type: 'select', options: ['console', 'slack', 'email'] },
      { key: 'message', label: 'Message', type: 'textarea', placeholder: 'Order {{payload.orderId}} processed' },
    ],
    defaultConfig: { channel: 'console', message: '' },
  },
  email: {
    label: 'Send Email',
    icon: Mail,
    color: '#ec4899',
    bg: '#ec489920',
    description: 'Send a real email via Gmail',
    fields: [
      { key: 'to', label: 'To (recipient email)', type: 'text', placeholder: 'receiver@example.com or {{payload.to}}' },
      { key: 'subject', label: 'Subject', type: 'text', placeholder: 'Subject line here' },
      { key: 'body', label: 'Body', type: 'textarea', placeholder: 'Email content... use {{parsed.field}} for AI-generated content' },
    ],
    defaultConfig: { to: '', subject: '', body: '' },
  },
  approval: {
    label: 'Approval Gate',
    icon: CheckSquare,
    color: '#ef4444',
    bg: '#ef444420',
    description: 'Pause for human approval',
    fields: [
      { key: 'message', label: 'Approval message', type: 'textarea', placeholder: 'This action needs review' },
    ],
    defaultConfig: { message: 'This action requires human approval' },
  },
};

export const PALETTE_ITEMS = ['ai', 'condition', 'http_request', 'delay', 'notify', 'email', 'approval'];