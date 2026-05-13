import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Dumbbell, KeyRound, CheckCircle2, Loader2 } from 'lucide-react';

/**
 * ClientSetupPage — reached via invite link:
 *   /setup-account?token=<invite_token>
 *
 * Flow:
 * 1. Verify token via anon-readable view (client_invite_lookup)
 * 2. Client sets email + password and calls supabase.auth.signUp
 * 3. On success, link clients row via user_id + stamp accepted_at
 * 4. Insert an internal notification for the trainer
 * 5. Redirect to /client-dashboard
 */
export default function ClientSetupPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { signUp, signIn, userRole, loading: authLoading } = useAuth();
  const inviteToken = params.get('token') ?? '';

  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [loading, setLoading]       = useState(false);
  const [verifying, setVerifying]   = useState(true);
  const [clientId, setClientId]     = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [tokenError, setTokenError] = useState<string | null>(null);

  // If already logged in as a client, go to dashboard
  useEffect(() => {
    if (!authLoading && userRole === 'client') navigate('/client-dashboard', { replace: true });
    if (!authLoading && userRole === 'trainer') navigate('/dashboard', { replace: true });
  }, [userRole, authLoading, navigate]);

  // Verify token on mount
  useEffect(() => {
    if (!inviteToken) {
      setVerifying(false);
      setTokenError('Link di invito non valido o mancante.');
      return;
    }

    const verifyToken = async () => {
      setVerifying(true);
      // Use the public view that only exposes id, name, email, invite_accepted
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, email, invite_accepted')
        .eq('invite_token', inviteToken)
        .maybeSingle();

      if (error || !data) {
        setTokenError('Link di invito non valido o scaduto.');
        setVerifying(false);
        return;
      }

      if (data.invite_accepted) {
        setTokenError('Questo link è già stato usato. Accedi normalmente.');
        setVerifying(false);
        return;
      }

      setClientId(data.id as string);
      setClientName((data.name as string) ?? '');
      if (data.email) setEmail(data.email as string);
      setVerifying(false);
    };

    verifyToken();
  }, [inviteToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim())          { toast.error('Inserisci la tua email'); return; }
    if (password !== confirm)   { toast.error('Le password non coincidono'); return; }
    if (password.length < 6)    { toast.error('Password di almeno 6 caratteri'); return; }
    if (!inviteToken || !clientId) { toast.error('Link di invito non valido'); return; }

    setLoading(true);
    try {
      // 1. Create auth user
      const { error: signUpError, session, user: createdUser } = await signUp(email.trim().toLowerCase(), password);
      
      if (signUpError) {
        // User might already exist — try signing in
        if (signUpError.message?.toLowerCase().includes('already registered') ||
            signUpError.message?.toLowerCase().includes('user already registered')) {
          toast.error('Esiste già un account con questa email. Prova ad accedere normalmente.');
          navigate('/login');
          return;
        }
        throw signUpError;
      }

      const authUserId = session?.user?.id ?? createdUser?.id;

      if (!authUserId) {
        // Email confirmation required by Supabase settings
        toast.info('Controlla la tua email per confermare l\'account, poi accedi dal link: /login');
        navigate('/login');
        return;
      }

      // 2. Link the clients row to the new auth user + stamp accepted_at
      const { error: updateErr } = await supabase
        .from('clients')
        .update({
          user_id: authUserId,
          email: email.trim().toLowerCase(),
          invite_accepted: true,
          accepted_at: new Date().toISOString(),
        } as never)
        .eq('invite_token', inviteToken)
        .eq('id', clientId);

      if (updateErr) throw updateErr;

      // 3. Notify trainer (best-effort — we need the activity_id from the client row)
      try {
        // Fetch client to get activity_id
        const { data: clientData } = await supabase
          .from('clients')
          .select('activity_id')
          .eq('id', clientId)
          .maybeSingle();

        if (clientData?.activity_id) {
          await supabase.from('notifications').insert({
            activity_id: clientData.activity_id,
            client_id: clientId,
            type: 'invite_accepted',
            channel: 'internal',
            title: 'Invito accettato',
            message: `${clientName} ha accettato il tuo invito e creato il suo account.`,
          } as never);
        }
      } catch {
        // Notification failure is non-blocking
      }

      toast.success('Account creato! Benvenuto!');
      // Auth state will update via onAuthStateChange → hydrateAuth → userRole=client → navigate
      navigate('/client-dashboard', { replace: true });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Errore durante la registrazione');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (verifying || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  // Token error state
  if (tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-lg font-semibold mb-2">Link non valido</h2>
          <p className="text-muted-foreground text-sm mb-4">{tokenError}</p>
          <Link to="/login">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" /> Vai al login
            </Button>
          </Link>
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
                autoComplete="email"
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
                autoComplete="new-password"
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
                autoComplete="new-password"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creazione account...</>
              ) : (
                <><KeyRound className="w-4 h-4 mr-2" /> Crea account e accedi</>
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-4">
            Hai già un account? <Link to="/login" className="text-primary hover:underline">Accedi</Link>
          </p>
        </div>

        {/* Feature highlights */}
        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          {[
            { icon: '📅', label: 'Sessioni' },
            { icon: '📈', label: 'Progressi' },
            { icon: '💪', label: 'Allenamenti' },
          ].map(f => (
            <div key={f.label} className="glass-card p-3">
              <div className="text-xl mb-1">{f.icon}</div>
              <div className="text-xs text-muted-foreground font-medium">{f.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
