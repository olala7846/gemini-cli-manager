// WARNING: The imported version of `zod` MUST exactly match the version used by `@google/gemini-cli-sdk`.
// If versions mismatch, the SDK's internal `zod-to-json-schema` library will fail its `instanceof ZodType` checks
// when parsing this tool's inputSchema, causing the agent initialization to fatally crash.
import { z } from 'zod';

export const ReportStatusTool = {
  name: 'report_status',
  description:
    'Use this tool to explicitly report your progress back to the system. You MUST call this tool when you are completely finished with a task, or when you are permanently blocked and cannot proceed without human intervention.',
  inputSchema: z.object({
    state: z
      .enum(['INPUT_NEEDED', 'COMPLETED', 'FAILED'])
      .describe(
        'The current state of your progress. Use INPUT_NEEDED if you are blocked and require human clarification. Use FAILED if you encountered an unrecoverable error.'
      ),
    reason: z
      .string()
      .describe('A clear, human-readable explanation of why you are blocked, failed, or what you have completed.')
  }),
  action: async (params: { state: string; reason: string }) => {
    return `Status reported as ${params.state}. Session will be paused if INPUT_NEEDED. System acknowledged.`;
  }
};
