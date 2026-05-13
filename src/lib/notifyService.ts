/**
 * notifyService.ts
 *
 * Helpers to insert rows into the existing `notifications` table.
 * The table schema uses activity_id + client_id (no user_id column).
 *
 * Routing:
 *  - Trainer notification → activity_id set, client_id = null
 *  - Client notification  → client_id set, activity_id from session
 */
import { supabase } from '@/integrations/supabase/client';

// Matches the existing notification_type enum in the DB
export type NotifType =
  | 'session_proposed'
  | 'session_confirmed'
  | 'session_rejected'
  | 'session_created'
  | 'session_rescheduled'
  | 'system';

interface TrainerNotifParams {
  activityId: string;
  type: NotifType;
  title: string;
  message: string;
}

interface ClientNotifParams {
  clientId: string;
  activityId: string;
  type: NotifType;
  title: string;
  message: string;
}

/** Fire-and-forget: errors are logged but never thrown to avoid breaking callers */
async function _insert(row: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('notifications').insert(row as never);
  if (error) {
    console.warn('[notifyService] insert error:', error.message);
  }
}

/** Notify the trainer (activity owner) */
export async function notifyTrainer(params: TrainerNotifParams): Promise<void> {
  await _insert({
    activity_id: params.activityId,
    client_id:   null,
    type:        params.type,
    title:       params.title,
    message:     params.message,
    is_read:     false,
    channel:     'internal',
  });
}

/** Notify a client */
export async function notifyClient(params: ClientNotifParams): Promise<void> {
  await _insert({
    activity_id: params.activityId,
    client_id:   params.clientId,
    type:        params.type,
    title:       params.title,
    message:     params.message,
    is_read:     false,
    channel:     'internal',
  });
}
