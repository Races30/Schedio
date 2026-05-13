/**
 * useCoachSessions
 *
 * Fetches sessions for either:
 *   - a trainer (by activity_id) — all sessions for their clients
 *   - a client  (by client_id)   — only this client's sessions
 *
 * Each session is enriched with its proposal history (session_proposals)
 * and the client record (for trainer view).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CoachSession, SessionProposal } from '@/types';

interface UseCoachSessionsOptions {
  /** Provide for trainer view */
  activityId?: string | null;
  /** Provide for client view */
  clientId?: string | null;
  /** If true, only fetch non-settled sessions */
  activeOnly?: boolean;
}

export function useCoachSessions({ activityId, clientId, activeOnly = false }: UseCoachSessionsOptions) {
  return useQuery<CoachSession[]>({
    queryKey: ['coach-sessions', activityId, clientId, activeOnly],
    queryFn: async () => {
      if (!activityId && !clientId) return [];

      let query = supabase
        .from('sessions')
        .select(`
          *,
          client:clients(id, name, first_name, last_name, email, phone),
          proposals:session_proposals(*)
        `)
        .order('created_at', { ascending: false });

      if (activityId) {
        query = query.eq('activity_id', activityId);
      }
      if (clientId) {
        query = query.eq('client_id', clientId);
      }
      if (activeOnly) {
        query = query.not('status', 'in', '("completata","annullata")');
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;

      // Sort proposals by created_at within each session
      return ((data || []) as CoachSession[]).map(s => ({
        ...s,
        proposals: ((s.proposals ?? []) as SessionProposal[]).sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ),
      }));
    },
    enabled: !!(activityId || clientId),
    refetchInterval: 30_000, // poll every 30s
  });
}

/** Trainer-only: only sessions that need trainer attention (pending trainer response) */
export function usePendingTrainerSessions(activityId: string | null | undefined) {
  const { data: all = [], ...rest } = useCoachSessions({ activityId });
  const pending = all.filter(s => {
    if (!['proposta', 'controproposta'].includes(s.status)) return false;
    const lastProp = s.proposals?.[s.proposals.length - 1];
    // If no proposals yet → trainer sees fresh client proposal
    if (!lastProp) return s.proposed_by === 'cliente';
    // Last proposal from client → trainer's turn
    return lastProp.proposed_by === 'cliente';
  });
  return { data: pending, all, ...rest };
}
