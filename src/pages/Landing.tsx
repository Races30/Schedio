import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Calendar, Users, Clock, Star, ArrowRight, Scissors, CheckCircle2, ChevronDown, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

const features = [
  { icon: Calendar, title: 'Calendario Smart', desc: 'Vista giornaliera e settimanale con appuntamenti colorati per dipendente.' },
  { icon: Users, title: 'Gestione Clienti', desc: 'Schede complete con storico appuntamenti, preferenze e note.' },
  { icon: Clock, title: 'Prenotazione Online', desc: 'Pagina pubblica professionale per ricevere prenotazioni 24/7.' },
  { icon: UserPlus, title: 'Multi-Dipendente', desc: 'Gestisci più dipendenti con servizi assegnati e calendari personali.' },
];

const steps = [
  { num: '01', title: 'Registrati', desc: 'Crea il tuo salone e configura i servizi.' },
  { num: '02', title: 'Aggiungi il team', desc: 'Inserisci dipendenti e assegna i servizi.' },
  { num: '03', title: 'Ricevi prenotazioni', desc: 'Condividi il link e gestisci tutto dal calendario.' },
];

const faqs = [
  { q: 'È gratuito?', a: 'Sì! Al momento la piattaforma è completamente gratuita. In futuro saranno disponibili piani premium.' },
  { q: 'Devo installare qualcosa?', a: 'No, funziona direttamente dal browser su qualsiasi dispositivo.' },
  { q: 'I miei clienti devono registrarsi?', a: 'No! I clienti prenotano dalla tua pagina pubblica senza creare un account.' },
  { q: 'Posso gestire più dipendenti?', a: 'Sì! Ogni dipendente ha il suo calendario, i suoi servizi e una pagina privata con link personale.' },
  { q: 'I clienti possono scegliere il dipendente?', a: 'Sì, possono scegliere un dipendente specifico o lasciare che il sistema assegni automaticamente il primo disponibile.' },
];

const plans = [
  { name: 'Base', price: '9', features: ['Prenotazioni illimitate', 'Calendario completo', 'Gestione clienti', 'Pagina prenotazione pubblica'] },
  { name: 'Pro', price: '19', features: ['Tutto di Base', 'Multi-dipendente', 'Promemoria automatici', 'Statistiche avanzate'], popular: true },
  { name: 'Premium', price: '29', features: ['Tutto di Pro', 'Automazioni', 'Report personalizzati', 'Supporto prioritario'] },
];

export default function Landing() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <span className="font-display text-xl font-bold text-foreground">Prenota<span className="text-primary">Pro</span></span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => navigate('/login')}>Accedi</Button>
            <Button variant="hero" onClick={() => navigate('/register')}>Inizia gratis</Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Star className="w-4 h-4" /> La piattaforma per il tuo salone
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground leading-tight mb-6">
              Gestisci il tuo salone<br />
              <span className="text-primary">senza complicazioni</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Calendario, dipendenti, servizi e prenotazioni online in un unico posto. Basta WhatsApp e agende cartacee.
            </p>
            <Button variant="hero" size="lg" onClick={() => navigate('/register')} className="text-base">
              <Scissors className="w-5 h-5" /> Crea il tuo salone
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-secondary/30">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-12">Tutto ciò che ti serve</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} viewport={{ once: true }}
                className="glass-card p-6 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mb-4">
                  <f.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-12">Come funziona</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.15 }} viewport={{ once: true }}
                className="text-center">
                <div className="text-5xl font-bold text-primary/20 mb-4">{s.num}</div>
                <h3 className="text-xl font-semibold mb-2">{s.title}</h3>
                <p className="text-muted-foreground">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-4 bg-secondary/30">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-2">Piani futuri</h2>
          <p className="text-muted-foreground text-center mb-8">Attualmente tutto è gratuito. Ecco cosa arriverà.</p>
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((p, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className={`glass-card p-6 relative ${p.popular ? 'ring-2 ring-primary' : ''}`}>
                {p.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">Popolare</div>}
                <h3 className="text-xl font-semibold mb-1">{p.name}</h3>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-3xl font-bold">{p.price}€</span>
                  <span className="text-muted-foreground text-sm">/mese</span>
                </div>
                <ul className="space-y-2">
                  {p.features.map((f, fi) => (
                    <li key={fi} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Button variant="outline" className="w-full mt-6" disabled>Prossimamente</Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-2xl">
          <h2 className="text-3xl font-bold text-center mb-12">Domande frequenti</h2>
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <div key={i} className="glass-card overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-4 text-left">
                  <span className="font-medium">{f.q}</span>
                  <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && <div className="px-4 pb-4 text-muted-foreground">{f.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold mb-4">Pronto a digitalizzare il tuo salone?</h2>
          <p className="text-muted-foreground mb-8">Inizia gratis oggi. Nessuna carta richiesta.</p>
          <Button variant="hero" size="lg" onClick={() => navigate('/register')}>
            Inizia ora <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      </section>

      <footer className="border-t border-border py-8 px-4">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          © 2026 PrenotaPro. Tutti i diritti riservati.
        </div>
      </footer>
    </div>
  );
}
