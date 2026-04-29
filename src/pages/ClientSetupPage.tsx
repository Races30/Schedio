import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Dumbbell, KeyRound } from 'lucide-react';

/**
 * ClientSetupPage — reached via invite link:
 *   /setup-account?token=<invite_token>
 *
 * The client sets their email + password. On success, their
 * auth.users record is linked to the clients row via user_id.
 */
export default function ClientSetupPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { signUp } = useAuth();
  const inviteToken = params.get('token') ?? '';

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [clientName, setClientName] = useState('');

  // Verify token on mount and pre-fill email
  useEffect(() => {
    const verifyToken = async () => {
      if (!inviteToken) return;
      const { data, error } = await supabase
        .from('clients')
        .select('name, email, invite_accepted')
        .eq('invite_token', inviteToken)
        .maybeSingle();
      
      if (error || !data) {
        toast.error('Link di invito non valido o scaduto.');
        return;
      }

      if (data.invite_accepted) {
        toast.info('Questo link è già stato usato. Accedi normalmente.');
        navigate('/login');
        return;
      }
      setClientName(data.name ?? '');
      if (data.email) setEmail(data.email);
    };
    
    verifyToken();
  }, [inviteToken, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { toast.error('Le password non coincidono'); return; }
    if (password.length < 6)  { toast.error('Password di almeno 6 caratteri'); return; }
    if (!inviteToken)          { toast.error('Link di invito non valido'); return; }

    setLoading(true);
    try {
      const { error, user: createdUser, session } = await signUp(email, password);
      if (error) throw error;

      const authUserId = session?.user.id ?? createdUser?.id;
      if (!authUserId) {
        // email confirmation required
        toast.success('Controlla la tua email per confermare, poi accedi.');
        navigate('/login');
        return;
      }

      // Link the clients row to the new auth user
      const { error: updateErr } = await supabase
        .from('clients')
        .update({
          user_id: authUserId,
          email: email.trim().toLowerCase(),
          invite_accepted: true,
        })
        .eq('invite_token', inviteToken);

      if (updateErr) throw updateErr;

      toast.success('Account creato! Benvenuto!');
      navigate('/client-dashboard', { replace: true });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Errore durante la registrazione');
    } finally {
      setLoading(false);
    }
  };

  if (!inviteToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-muted-foreground">Link di invito non valido o mancante.</p>
          <Link to="/login" className="text-primary hover:underline text-sm mt-2 block">Vai al login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="glass-card p-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <Dumbbell className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold">
                {clientName ? `Ciao ${clientName}!` : 'Crea il tuo account'}
              </h1>
              <p className="text-sm text-muted-foreground">Il tuo trainer ti ha invitato</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-6">
            Scegli email e password per accedere alla tua dashboard personale
            e vedere i tuoi progressi.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="setup-email">Email *</Label>
              <Input
                id="setup-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="la-tua@email.com"
                required
              />
            </div>
            <div>
              <Label htmlFor="setup-pw">Password *</Label>
              <Input
                id="setup-pw"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Minimo 6 caratteri"
                required
              />
            </div>
            <div>
              <Label htmlFor="setup-pw2">Conferma password *</Label>
              <Input
                id="setup-pw2"
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Ripeti la password"
                required
              />
            </div>
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" disabled={loading}>
              <KeyRound className="w-4 h-4 mr-2" />
              {loading ? 'Creazione account...' : 'Crea account e accedi'}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-4">
            Hai già un account? <Link to="/login" className="text-primary hover:underline">Accedi</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
