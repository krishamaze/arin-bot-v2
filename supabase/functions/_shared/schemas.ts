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
  // Backward compatibility: girlId is optional, will be auto-detected if not provided
  girlId: z.string().min(1, 'Girl ID required').optional(),
  // New: explicit target user ID (takes precedence over girlId)
  targetUserId: z.string().min(1, 'Target user ID required').optional(),
  girlName: z.string().optional(),
  recentMessages: z.array(z.object({
    sender: z.enum(['user', 'girl']), // Backward compatibility
    senderId: z.string().optional(), // Platform ID for group chat support
    text: z.string().min(1),
    timestamp: z.number().positive(),
    messageType: z.enum(['social', 'pm', 'mentioned', 'group', 'one_on_one']).optional()
  })).optional(),
  // Auto-detected participants (optional, will be extracted from messages if not provided)
  detectedParticipants: z.array(z.string()).optional(),
  // Profile management
  profileId: z.string().uuid().optional(),
  autoDetectProfile: z.boolean().optional()
}).refine(
  (data) => data.girlId || data.targetUserId || (data.recentMessages && data.recentMessages.length > 0),
  {
    message: 'Either girlId, targetUserId, or recentMessages must be provided'
  }
);

// Response schemas
export const WingmanResponseSchema = z.object({
  conversationType: z.enum(['one_on_one', 'group']),
  detectedParticipants: z.array(z.string()).optional(),
  targetUser: z.object({
    platformId: z.string(),
    displayName: z.string().optional(),
    gender: z.enum(['unknown', 'male', 'female', 'non_binary']).optional()
  }).optional(),
  analysis: z.object({
    her_last_message_feeling: z.string().optional(), // Optional for group chats
    their_last_message_feeling: z.string().optional(), // Gender-neutral alternative
    conversation_vibe: z.string(),
    recommended_goal: z.string(),
    group_dynamics: z.string().optional() // Only present in group chats
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

