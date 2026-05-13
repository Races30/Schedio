/**
 * NotificationBell
 *
 * Reads from the existing `notifications` table (activity_id + client_id schema).
 * Trainer sees notifications where activity_id = their activity AND client_id IS NULL.
 * Client sees notifications where client_id = their client row id.
 *
 * Features:
 *  - Badge with unread count
 *  - Dropdown with last 10 notifications
 *  - "time ago" display (e.g. "2 ore fa")
 *  - Click notification → mark as read
 *  - "Segna tutte come lette" button
 *  - Supabase Realtime for live updates
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean | null;
  created_at: string;
  client_id: string | null;
  activity_id: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Time-ago helper
// ─────────────────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diffMs  = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1)  return 'proprio ora';
  if (diffMin < 60) return `${diffMin} min fa`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)   return `${diffH} or${diffH === 1 ? 'a' : 'e'} fa`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7)    return `${diffD} giorn${diffD === 1 ? 'o' : 'i'} fa`;
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

// Emoji per tipo di notifica
function notifIcon(type: string): string {
  const map: Record<string, string> = {
    session_proposed:    '📨',
    session_confirmed:   '✅',
    session_rejected:    '❌',
    session_created:     '📅',
    session_rescheduled: '🔄',
    invite_accepted:     '🎉',
    package_expiring:    '⏳',
    retention_inactive:  '😴',
    reminder_24h:        '⏰',
    system:              '🔔',
  };
  return map[type] ?? '🔔';
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function NotificationBell() {
  const { user, activity, userRole, clientProfile } = useAuth();
  const qc  = useQueryClient();
  const [open, setOpen] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Build filter based on role
  const isTrainer = userRole === 'trainer' || userRole === null;
  const clientId  = (clientProfile as { id?: string } | null)?.id ?? null;

  // ── Fetch notifications ─────────────────────────────────────────────────
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['notifications', activity?.id, clientId, isTrainer],
    queryFn: async () => {
      if (!activity?.id) return [];

      let q = supabase
        .from('notifications')
        .select('id, type, title, message, is_read, created_at, client_id, activity_id')
        .eq('activity_id', activity.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (isTrainer) {
        // Trainer sees notifications without a client target
        q = q.is('client_id', null);
      } else if (clientId) {
        // Client sees their own notifications
        q = q.eq('client_id', clientId);
      } else {
        return [];
      }

      const { data, error } = await q;
      if (error && error.code !== '42P01') throw error;
      return (data ?? []) as Notification[];
    },
    enabled: !!activity?.id && !!user,
  });

  // ── Realtime subscription ───────────────────────────────────────────────
  // Keep invalidate in a ref so the useEffect deps stay stable and the
  // channel is never torn down/recreated just because qc changed identity.
  const invalidateRef = useRef<() => void>(() => {});
  useEffect(() => {
    invalidateRef.current = () => qc.invalidateQueries({ queryKey: ['notifications'] });
  });

  useEffect(() => {
    if (!activity?.id) return;

    // Cleanup canale precedente se esiste
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channelName = `notifications-${activity.id}-${clientId ?? 'trainer'}-${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `activity_id=eq.${activity.id}`,
        },
        () => invalidateRef.current(),
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity?.id, clientId]);

  // ── Mark as read ────────────────────────────────────────────────────────
  const markOne = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };

  const markAll = async () => {
    const unread = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unread.length === 0) return;
    await supabase.from('notifications').update({ is_read: true }).in('id', unread);
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className={`w-5 h-5 transition-colors ${unreadCount > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute top-1 right-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-destructive rounded-full"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0 mr-4" align="end">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/20">
          <h4 className="font-semibold text-sm flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5 text-primary" />
            Notifiche
            {unreadCount > 0 && (
              <span className="bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground gap-1"
              onClick={markAll}
            >
              <CheckCheck className="w-3 h-3" />
              Segna tutte lette
            </Button>
          )}
        </div>

        {/* List */}
        <ScrollArea className="h-[320px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center text-muted-foreground">
              <Bell className="w-8 h-8 mb-3 opacity-20" />
              <p className="text-sm font-medium">Nessuna notifica</p>
              <p className="text-xs mt-1 opacity-70">Le notifiche appariranno qui</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border/50">
              {notifications.map((note, i) => (
                <motion.div
                  key={note.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`px-4 py-3 flex gap-3 cursor-pointer transition-colors hover:bg-muted/50 ${
                    !note.is_read ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => {
                    if (!note.is_read) markOne(note.id);
                  }}
                >
                  {/* Icon */}
                  <span className="text-lg flex-shrink-0 mt-0.5 leading-none">
                    {notifIcon(note.type)}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium leading-tight ${!note.is_read ? 'text-foreground' : 'text-foreground/75'}`}>
                        {note.title}
                      </p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                        {timeAgo(note.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{note.message}</p>
                  </div>

                  {/* Unread dot */}
                  {!note.is_read && (
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="px-4 py-2 border-t border-border bg-muted/10 text-center">
            <button
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setOpen(false)}
            >
              Chiudi
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
