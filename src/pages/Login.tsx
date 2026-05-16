import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, User } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { signIn, userRole, loading } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Redirect once role is resolved after sign-in
  useEffect(() => {
    if (!loading && userRole === 'trainer') navigate('/dashboard',        { replace: true });
    if (!loading && userRole === 'client')  navigate('/client-dashboard', { replace: true });
  }, [userRole, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await signIn(email, password);
      if (error) throw error;
      // Redirect handled by the useEffect above once AuthContext resolves the role
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Credenziali non valide');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="w-4 h-4" /> Torna alla home
        </Link>

        <div className="glass-card p-8">
          <h1 className="text-2xl font-bold mb-1">Bentornato</h1>
          <p className="text-muted-foreground mb-6">Accedi al tuo account</p>

          <div className="mb-6 flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
            <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
              <User className="h-5 w-5" />
            </div>
            <div className="space-y-1 leading-relaxed">
              <p className="font-semibold">👤 Sei un cliente?</p>
              <p>Accedi con l'email e la password che hai scelto quando hai accettato l'invito del tuo trainer.</p>
              <p>Non hai ancora un account? Controlla la tua email — il tuo trainer ti ha inviato un link di invito.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="la-tua@email.com" required />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="La tua password" required />
            </div>
            <Button type="submit" variant="hero" className="w-full" disabled={submitting || loading}>
              {submitting || loading ? 'Accesso...' : 'Accedi'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Non hai un account? <Link to="/register" className="text-primary hover:underline">Registrati</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
