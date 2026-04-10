import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Calendar, Users, Clock, Star, ArrowRight, Scissors, Dumbbell, CheckCircle2, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

const features = [
  { icon: Calendar, title: 'Calendario Smart', desc: 'Vista giornaliera e settimanale con blocchi colorati e drag & drop.' },
  { icon: Users, title: 'Gestione Clienti', desc: 'Schede complete con storico, preferenze e note personalizzate.' },
  { icon: Clock, title: 'Prenotazione Online', desc: 'Pagina pubblica per ricevere prenotazioni 24/7 senza login.' },
  { icon: Star, title: 'Pacchetti & Progressi', desc: 'Per i coach: gestisci sessioni, pacchetti e progressi clienti.' },
];

const steps = [
  { num: '01', title: 'Registrati', desc: 'Crea il tuo account e scegli la tua categoria.' },
  { num: '02', title: 'Configura', desc: 'Imposta orari, servizi e personalizza il tuo profilo.' },
  { num: '03', title: 'Gestisci', desc: 'Calendario, clienti e prenotazioni a portata di mano.' },
];

const faqs = [
  { q: 'È gratuito?', a: 'Sì! Al momento la piattaforma è completamente gratuita. In futuro saranno disponibili piani premium con funzionalità avanzate.' },
  { q: 'Devo installare qualcosa?', a: 'No, funziona direttamente dal browser su qualsiasi dispositivo.' },
  { q: 'I miei clienti devono registrarsi?', a: 'No! I tuoi clienti possono prenotare dalla tua pagina pubblica senza creare un account.' },
  { q: 'Posso personalizzare la durata degli appuntamenti?', a: 'Sì, puoi impostare una durata predefinita e modificarla per ogni singolo appuntamento.' },
];

const salonePlans = [
  { name: 'Base', price: '9', features: ['Prenotazioni illimitate', 'Calendario completo', 'Gestione clienti', 'Pagina prenotazione pubblica'] },
  { name: 'Pro', price: '19', features: ['Tutto di Base', 'Promemoria automatici', 'Statistiche avanzate', 'Report settimanali'], popular: true },
  { name: 'Premium', price: '29', features: ['Tutto di Pro', 'Multi-operatore', 'Automazioni', 'Report personalizzati'] },
];

const coachPlans = [
  { name: 'Base', price: '12', features: ['Gestione clienti', 'Prenotazioni', 'Scheda cliente', 'Calendario sessioni'] },
  { name: 'Pro', price: '24', features: ['Tutto di Base', 'Pacchetti sedute', 'Progressi clienti', 'Promemoria rinnovi'], popular: true },
  { name: 'Premium', price: '39', features: ['Tutto di Pro', 'Rinnovi automatici', 'Statistiche avanzate', 'Gestione completa'] },
];

export default function Landing() {
  const navigate = useNavigate();
  const [pricingTab, setPricingTab] = useState<'salone' | 'coach'>('salone');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const plans = pricingTab === 'salone' ? salonePlans : coachPlans;

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
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
              <Star className="w-4 h-4" /> Gratuito per sempre • Nessuna carta richiesta
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground leading-tight mb-6">
              Gestisci il tuo business<br />
              <span className="text-primary">senza complicazioni</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              La piattaforma all-in-one per barbieri, parrucchieri e personal trainer. Calendario, clienti e prenotazioni online in un unico posto.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="hero" size="lg" onClick={() => navigate('/register')} className="text-base">
                <Scissors className="w-5 h-5" /> Sono un Salone
              </Button>
              <Button variant="outline" size="lg" onClick={() => navigate('/register')} className="text-base border-coach text-coach hover:bg-coach hover:text-coach-foreground">
                <Dumbbell className="w-5 h-5" /> Sono un Coach
              </Button>
            </div>
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

      {/* How it works */}
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
          <div className="flex justify-center mb-8">
            <div className="inline-flex bg-muted rounded-lg p-1">
              <button onClick={() => setPricingTab('salone')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${pricingTab === 'salone' ? 'bg-salone text-salone-foreground' : 'text-muted-foreground'}`}>
                Salone
              </button>
              <button onClick={() => setPricingTab('coach')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${pricingTab === 'coach' ? 'bg-coach text-coach-foreground' : 'text-muted-foreground'}`}>
                Coach
              </button>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((p, i) => (
              <motion.div key={`${pricingTab}-${i}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
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
                      <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                      {f}
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
          <h2 className="text-3xl font-bold mb-4">Pronto a semplificare la tua giornata?</h2>
          <p className="text-muted-foreground mb-8">Inizia gratis oggi e scopri quanto può essere facile gestire il tuo business.</p>
          <Button variant="hero" size="lg" onClick={() => navigate('/register')}>
            Inizia ora <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          © 2026 PrenotaPro. Tutti i diritti riservati.
        </div>
      </footer>
    </div>
  );
}
