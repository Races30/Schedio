import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Package, AlertTriangle } from 'lucide-react';
import { Client, Package as PackageType } from '@/types';
import { toast } from 'sonner';
import { formatDate } from '@/utils/dateHelpers';

export default function PackagesPage() {
  const { activity } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editPkg, setEditPkg] = useState<PackageType | null>(null);
  const [search, setSearch] = useState('');

  const { data: packages = [] } = useQuery({
    queryKey: ['packages', activity?.id],
    queryFn: async () => {
      const { data } = await supabase.from('packages').select('*').eq('activity_id', activity!.id).order('created_at', { ascending: false });
      return (data || []) as PackageType[];
    },
    enabled: !!activity,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', activity?.id],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('*').eq('activity_id', activity!.id).order('name');
      return (data || []) as Client[];
    },
    enabled: !!activity,
  });

  if (!activity) return null;

  const filtered = packages.filter(p => {
    const client = clients.find(c => c.id === p.client_id);
    const clientName = client?.name || '';
    return p.name.toLowerCase().includes(search.toLowerCase()) || clientName.toLowerCase().includes(search.toLowerCase());
  });

  const getClient = (id: string) => clients.find(c => c.id === id);

  const statusBadge = (p: PackageType) => {
    const remaining = p.total_sessions - p.used_sessions;
    if (remaining <= 0) return <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">Esaurito</span>;
    if (p.end_date) {
      const daysLeft = Math.ceil((new Date(p.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 0) return <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">Scaduto</span>;
      if (daysLeft <= 7) return <span className="text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning font-medium">In scadenza</span>;
    }
    if (remaining <= 2) return <span className="text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning font-medium">Poche sedute</span>;
    return <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success font-medium">Attivo</span>;
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Pacchetti</h1>
        <Button onClick={() => { setEditPkg(null); setDialogOpen(true); }} variant="hero">
          <Plus className="w-4 h-4" /> Nuovo pacchetto
        </Button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca pacchetti..." className="pl-10" />
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{search ? 'Nessun risultato' : 'Nessun pacchetto creato'}</p>
          {!search && <Button variant="outline" className="mt-4" onClick={() => { setEditPkg(null); setDialogOpen(true); }}>Crea il primo pacchetto</Button>}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(p => {
            const client = getClient(p.client_id);
            const remaining = p.total_sessions - p.used_sessions;
            return (
              <div key={p.id} className="glass-card p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => { setEditPkg(p); setDialogOpen(true); }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium flex items-center gap-2">{p.name} {statusBadge(p)}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {client?.name || 'Cliente non trovato'} • {p.used_sessions}/{p.total_sessions} sedute
                      {p.price != null && ` • €${p.price}`}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {p.start_date && `Dal ${formatDate(p.start_date)}`}
                      {p.end_date && ` al ${formatDate(p.end_date)}`}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-2xl font-bold">{remaining}</div>
                    <div className="text-xs text-muted-foreground">rimanenti</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PackageDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        pkg={editPkg}
        activityId={activity.id}
        clients={clients}
      />
    </div>
  );
}

function PackageDialog({ open, onClose, pkg, activityId, clients }: {
  open: boolean; onClose: () => void; pkg: PackageType | null; activityId: string; clients: Client[];
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [totalSessions, setTotalSessions] = useState(10);
  const [usedSessions, setUsedSessions] = useState(0);
  const [price, setPrice] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('active');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (pkg) {
      setName(pkg.name);
      setClientId(pkg.client_id);
      setTotalSessions(pkg.total_sessions);
      setUsedSessions(pkg.used_sessions);
      setPrice(pkg.price != null ? String(pkg.price) : '');
      setStartDate(pkg.start_date || '');
      setEndDate(pkg.end_date || '');
      setNotes(pkg.notes || '');
      setStatus(pkg.status);
    } else {
      setName('');
      setClientId('');
      setTotalSessions(10);
      setUsedSessions(0);
      setPrice('');
      setStartDate(new Date().toISOString().split('T')[0]);
      setEndDate('');
      setNotes('');
      setStatus('active');
    }
  }, [open, pkg?.id, pkg]);

  const save = async () => {
    if (!name.trim() || !clientId) { toast.error('Nome e cliente sono obbligatori'); return; }
    setLoading(true);
    try {
      const payload = {
        activity_id: activityId,
        client_id: clientId,
        name: name.trim(),
        total_sessions: totalSessions,
        used_sessions: usedSessions,
        price: price.trim() ? parseFloat(price) : null,
        start_date: startDate || null,
        end_date: endDate || null,
        notes: notes || null,
        status,
      };
      if (pkg) {
        const { error } = await supabase.from('packages').update(payload).eq('id', pkg.id);
        if (error) throw error;
        toast.success('Pacchetto aggiornato');
      } else {
        const { error } = await supabase.from('packages').insert(payload);
        if (error) throw error;
        toast.success('Pacchetto creato');
      }
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const deletePkg = async () => {
    if (!pkg) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('packages').delete().eq('id', pkg.id);
      if (error) throw error;
      toast.success('Pacchetto eliminato');
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{pkg ? 'Modifica pacchetto' : 'Nuovo pacchetto'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Nome pacchetto *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="es. 10 Sessioni" /></div>
          <div>
            <Label>Cliente *</Label>
            <Select value={clientId || '__none__'} onValueChange={v => setClientId(v === '__none__' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Seleziona cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Seleziona...</SelectItem>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><Label>Totale sedute</Label><Input type="number" value={totalSessions} onChange={e => setTotalSessions(Number(e.target.value))} min={1} /></div>
            <div><Label>Usate</Label><Input type="number" value={usedSessions} onChange={e => setUsedSessions(Number(e.target.value))} min={0} max={totalSessions} /></div>
            <div><Label>Prezzo (€)</Label><Input value={price} onChange={e => setPrice(e.target.value)} placeholder="0" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Data inizio</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
            <div><Label>Data fine</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
          </div>
          <div>
            <Label>Stato</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Attivo</SelectItem>
                <SelectItem value="completed">Completato</SelectItem>
                <SelectItem value="expired">Scaduto</SelectItem>
                <SelectItem value="paused">In pausa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Note</Label><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Note opzionali" /></div>
          <div className="text-sm text-muted-foreground">Sedute rimanenti: <strong>{totalSessions - usedSessions}</strong></div>
          <div className="flex gap-2">
            {pkg && <Button variant="destructive" onClick={deletePkg} disabled={loading}>Elimina</Button>}
            <Button variant="hero" onClick={save} disabled={loading} className="flex-1">
              {loading ? 'Salvataggio...' : pkg ? 'Aggiorna' : 'Crea'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
