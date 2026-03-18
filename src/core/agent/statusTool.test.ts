import { describe, it, expect } from 'vitest';
import { ReportStatusTool } from './statusTool.js';

describe('ReportStatusTool', () => {
  it('returns expected ACK string for INPUT_NEEDED', async () => {
    const result = await ReportStatusTool.action({ state: 'INPUT_NEEDED', reason: 'test' });
    expect(result).toContain('INPUT_NEEDED');
    expect(result).toContain('paused');
  });

  it('returns expected ACK string for COMPLETED', async () => {
    const result = await ReportStatusTool.action({ state: 'COMPLETED', reason: 'done' });
    expect(result).toContain('COMPLETED');
  });

  it('returns expected ACK string for FAILED', async () => {
    const result = await ReportStatusTool.action({ state: 'FAILED', reason: 'error' });
    expect(result).toContain('FAILED');
  });

  it('inputSchema accepts INPUT_NEEDED, COMPLETED, FAILED', () => {
    const valid = ReportStatusTool.inputSchema.safeParse({ state: 'INPUT_NEEDED', reason: 'test' });
    expect(valid.success).toBe(true);
    const valid2 = ReportStatusTool.inputSchema.safeParse({ state: 'COMPLETED', reason: 'done' });
    expect(valid2.success).toBe(true);
    const valid3 = ReportStatusTool.inputSchema.safeParse({ state: 'FAILED', reason: 'err' });
    expect(valid3.success).toBe(true);
  });

  it('inputSchema rejects unknown state values', () => {
    const invalid = ReportStatusTool.inputSchema.safeParse({ state: 'BLOCKED', reason: 'test' });
    expect(invalid.success).toBe(false);
  });
});
