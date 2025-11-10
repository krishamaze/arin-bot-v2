// Zod validation schemas for Wingman API
import { z } from 'https://deno.land/x/zod/mod.ts';

// Request schemas
export const InitRequestSchema = z.object({
  platformId: z.string().min(1, 'Platform ID required'),
  username: z.string().min(1, 'Username required'),
  roomPath: z.string().startsWith('/', 'Invalid room path')
});

export const WingmanRequestSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID'),
  userId: z.string().min(1, 'User ID required'),
  girlId: z.string().min(1, 'Girl ID required'),
  girlName: z.string().optional(),
  recentMessages: z.array(z.object({
    sender: z.enum(['user', 'girl']),
    text: z.string().min(1),
    timestamp: z.number().positive()
  })).optional()
});

// Response schemas
export const WingmanResponseSchema = z.object({
  analysis: z.object({
    her_last_message_feeling: z.string(),
    conversation_vibe: z.string(),
    recommended_goal: z.string()
  }),
  suggestion: z.object({
    type: z.string(),
    text: z.string(),
    rationale: z.string()
  }),
  wingman_tip: z.string()
});

// TypeScript types
export type InitRequest = z.infer<typeof InitRequestSchema>;
export type WingmanRequest = z.infer<typeof WingmanRequestSchema>;
export type WingmanResponse = z.infer<typeof WingmanResponseSchema>;

