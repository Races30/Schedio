import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Search, Phone, Mail, Edit } from 'lucide-react';
import { Client, Appointment } from '@/types';
import { toast } from 'sonner';
import { formatDate, formatTime } from '@/utils/dateHelpers';

export default function ClientsPage() {
  const { activity } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [detailClient, setDetailClient] = useState<Client | null>(null);

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', activity?.id],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('*').eq('activity_id', activity!.id).order('name');
      return (data || []) as Client[];
    },
    enabled: !!activity,
  });

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  const openNew = () => { setEditClient(null); setDialogOpen(true); };
  const openEdit = (c: Client) => { setEditClient(c); setDialogOpen(true); };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Clienti</h1>
        <Button onClick={openNew} variant="hero">
          <Plus className="w-4 h-4" /> Nuovo cliente
        </Button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca clienti..." className="pl-10" />
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-muted-foreground">{search ? 'Nessun risultato' : 'Nessun cliente registrato'}</p>
          {!search && <Button variant="outline" className="mt-4" onClick={openNew}>Aggiungi il primo cliente</Button>}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(c => (
            <div key={c.id} className="glass-card p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setDetailClient(c)}>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary flex-shrink-0">
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{c.name}</div>
                <div className="text-sm text-muted-foreground flex items-center gap-3">
                  {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</span>}
                  {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</span>}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); openEdit(c); }}>
                <Edit className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <ClientDialog open={dialogOpen} onClose={() => setDialogOpen(false)} client={editClient} activityId={activity?.id || ''} />

      {detailClient && (
        <ClientDetailDialog client={detailClient} onClose={() => setDetailClient(null)} activityId={activity?.id || ''} />
      )}
    </div>
  );
}

function ClientDialog({ open, onClose, client, activityId }: {
  open: boolean; onClose: () => void; client: Client | null; activityId: string;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(client?.name || '');
  const [phone, setPhone] = useState(client?.phone || '');
  const [email, setEmail] = useState(client?.email || '');
  const [notes, setNotes] = useState(client?.notes || '');
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (!name.trim()) { toast.error('Il nome è obbligatorio'); return; }
    setLoading(true);
    try {
      const payload = { activity_id: activityId, name: name.trim(), phone: phone || null, email: email || null, notes: notes || null };
      if (client) {
        await supabase.from('clients').update(payload).eq('id', client.id);
        toast.success('Cliente aggiornato');
      } else {
        await supabase.from('clients').insert(payload);
        toast.success('Cliente creato');
      }
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteClient = async () => {
    if (!client) return;
    setLoading(true);
    try {
      await supabase.from('clients').delete().eq('id', client.id);
      toast.success('Cliente eliminato');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useState(() => {
    setName(client?.name || '');
    setPhone(client?.phone || '');
    setEmail(client?.email || '');
    setNotes(client?.notes || '');
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{client ? 'Modifica cliente' : 'Nuovo cliente'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div><Label>Nome *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome e cognome" /></div>
          <div><Label>Telefono</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+39 123 456 7890" /></div>
          <div><Label>Email</Label><Input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@esempio.com" type="email" /></div>
          <div><Label>Note</Label><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Note opzionali" /></div>
          <div className="flex gap-2">
            {client && <Button variant="destructive" onClick={deleteClient} disabled={loading}>Elimina</Button>}
            <Button variant="hero" onClick={save} disabled={loading} className="flex-1">
              {loading ? 'Salvataggio...' : client ? 'Aggiorna' : 'Crea'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ClientDetailDialog({ client, onClose, activityId }: {
  client: Client; onClose: () => void; activityId: string;
}) {
  const { data: appointments = [] } = useQuery({
    queryKey: ['client-appointments', client.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('appointments')
        .select('*, service:services(*)')
        .eq('client_id', client.id)
        .order('date', { ascending: false })
        .limit(10);
      return (data || []) as Appointment[];
    },
  });

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
              {client.name.charAt(0).toUpperCase()}
            </div>
            {client.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="space-y-2">
            {client.phone && <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-muted-foreground" /> {client.phone}</div>}
            {client.email && <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-muted-foreground" /> {client.email}</div>}
            {client.notes && <p className="text-sm text-muted-foreground">{client.notes}</p>}
          </div>
          <div>
            <h3 className="font-semibold mb-2">Storico appuntamenti</h3>
            {appointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun appuntamento</p>
            ) : (
              <div className="space-y-2">
                {appointments.map(a => (
                  <div key={a.id} className="flex items-center gap-3 bg-muted/50 rounded-lg p-3">
                    <div className="w-1 h-8 rounded-full" style={{ backgroundColor: a.color || a.service?.color || '#3b82f6' }} />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{a.service?.name || 'Appuntamento'}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(a.date)} • {formatTime(a.start_time)}</div>
                    </div>
                    <span className={`status-badge status-${a.status}`}>
                      {a.status === 'confirmed' ? 'Conf.' : a.status === 'completed' ? 'Fatto' : a.status === 'cancelled' ? 'Ann.' : 'Attesa'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
