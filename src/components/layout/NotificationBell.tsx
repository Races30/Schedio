import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

export function NotificationBell() {
  const { activity } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  useQuery({
    queryKey: ['generate_retention_alerts', activity?.id],
    queryFn: async () => {
      if (!activity) return null;
      console.log("Generazione avvisi di retention...");
      const { error } = await supabase.rpc('generate_retention_alerts', { target_activity_id: activity.id });
      if (error) {
        console.error("RPC Error (might be missing in DB if unmerged):", error);
      } else {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['clients'] });
      }
      return true;
    },
    enabled: !!activity,
  });

  const { data: notifications } = useQuery({
    queryKey: ['notifications', activity?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('activity_id', activity!.id)
        .order('created_at', { ascending: false })
        .limit(30);
      
      if (error && error.code !== '42P01') throw error; // Ignore table doesn't exist error in MVP transition
      return data || [];
    },
    enabled: !!activity,
  });

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const unreadCount = notifications?.filter(n => !n.is_read)?.length || 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="w-5 h-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-2 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-destructive rounded-full">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 mr-4" align="end">
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
          <h4 className="font-semibold">Notifiche</h4>
          {unreadCount > 0 && (
            <span className="text-xs font-medium text-muted-foreground">{unreadCount} da leggere</span>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {notifications?.length === 0 ? (
             <div className="flex flex-col flex-1 items-center justify-center p-8 text-center text-muted-foreground">
               <Bell className="w-8 h-8 mb-3 opacity-20" />
               <p className="text-sm">Nessuna notifica</p>
             </div>
          ) : (
            <div className="flex flex-col">
              {notifications?.map(note => (
                <div 
                  key={note.id} 
                  className={`p-4 border-b border-border/50 text-sm flex gap-3 transition-colors cursor-pointer hover:bg-muted/50 ${!note.is_read ? 'bg-primary/5' : ''}`}
                  onClick={() => {
                    if (!note.is_read) markAsRead.mutate(note.id);
                  }}
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`font-medium leading-tight ${!note.is_read ? 'text-foreground' : 'text-foreground/80'}`}>{note.title}</p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {format(new Date(note.created_at), 'dd MMM HH:mm', { locale: it })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{note.message}</p>
                  </div>
                  {!note.is_read && (
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
