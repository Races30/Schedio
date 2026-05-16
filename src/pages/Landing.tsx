import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  BarChart3,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  CreditCard,
  Star,
  TrendingUp,
  User,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

const features = [
  {
    icon: ClipboardList,
    title: 'Schede allenamento',
    desc: 'Crea schede personalizzate con esercizi, serie e recupero. Il cliente le vede direttamente dal telefono.',
  },
  {
    icon: TrendingUp,
    title: 'Progressi e misure',
    desc: 'Traccia peso, misure corporee e progressi sugli esercizi. I grafici parlano da soli.',
  },
  {
    icon: Calendar,
    title: 'Sessioni e calendario',
    desc: 'Pianifica le sessioni, il cliente propone gli orari. Niente più messaggi su WhatsApp.',
  },
  {
    icon: Bell,
    title: 'Promemoria automatici',
    desc: 'Email automatica 24 ore prima di ogni sessione. Zero no-show, zero dimenticanze.',
  },
  {
    icon: CreditCard,
    title: 'Pacchetti sedute',
    desc: 'Vendi pacchetti da 10, 20 o 30 sessioni. Il conteggio è automatico.',
  },
  {
    icon: BarChart3,
    title: 'Dashboard cliente',
    desc: "Il cliente vede le sue schede, i progressi e le sessioni in un'area dedicata. Tutto aggiornato in tempo reale.",
  },
];

const steps = [
  {
    num: '01',
    title: 'Crei il tuo account',
    desc: 'Registrati gratis. Nessuna carta richiesta.',
  },
  {
    num: '02',
    title: 'Aggiungi i tuoi clienti',
    desc: 'Mandi un link via email. Il cliente crea il suo account in un minuto.',
  },
  {
    num: '03',
    title: 'Gestisci tutto da qui',
    desc: 'Schede, sessioni, progressi. Il tuo studio digitale è pronto.',
  },
];

const plans = [
  {
    name: 'Free',
    price: '0',
    features: ['Fino a 3 clienti', 'Schede allenamento', 'Progressi esercizi', 'Sessioni illimitate'],
    cta: 'Inizia gratis',
    available: true,
  },
  {
    name: 'Pro',
    price: '19',
    features: [
      'Clienti illimitati',
      'Tutto del Free +',
      'Analytics avanzate',
      'Promemoria email automatici',
      'Template schede',
      'Disponibilità settimanale',
      'Misure corporee',
    ],
    cta: 'Prossimamente',
    popular: true,
  },
  {
    name: 'Business',
    price: '39',
    features: ['Tutto del Pro +', 'Fino a 5 trainer', 'Dashboard owner', 'Supporto prioritario'],
    cta: 'Prossimamente',
  },
];

const faqs = [
  {
    q: 'È davvero gratis?',
    a: 'Sì. Il piano Free è gratis per sempre fino a 3 clienti. Nessuna carta richiesta.',
  },
  {
    q: "I miei clienti devono scaricare un'app?",
    a: 'No. Accedono dal browser del telefono con un link che gli mandi tu. Funziona su qualsiasi dispositivo.',
  },
  {
    q: 'Come aggiungo un cliente?',
    a: 'Inserisci il suo nome e email, Schedio gli manda un link di invito. In un minuto è dentro.',
  },
  {
    q: 'Posso importare i miei clienti esistenti?',
    a: "Per ora li aggiungi manualmente uno alla volta. L'import massivo arriverà presto.",
  },
  {
    q: 'Cosa succede se supero i 3 clienti del piano Free?',
    a: 'Ti avvisiamo prima. Potrai passare al piano Pro o rimuovere un cliente inattivo.',
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <span className="font-display text-xl font-bold text-foreground">Schedio</span>
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
              <Star className="w-4 h-4" /> Il gestionale per personal trainer
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground leading-tight mb-6">
              Smetti di gestire i clienti su WhatsApp.<br />
              <span className="text-primary">Inizia a farlo come un professionista.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Schede allenamento, progressi, sessioni e pagamenti. Tutto in un posto. I tuoi clienti accedono con un link, senza scaricare niente.
            </p>
            <Button variant="hero" size="lg" onClick={() => navigate('/register')} className="text-base">
              Inizia gratis
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-secondary/30">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-12">Tutto quello che ti serve, niente di più</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="glass-card p-6 hover:shadow-md transition-shadow"
              >
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
          <h2 className="text-3xl font-bold text-center mb-12">Inizia in 3 minuti</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <motion.div
                key={s.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.15 }}
                viewport={{ once: true }}
                className="text-center"
              >
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
          <h2 className="text-3xl font-bold text-center mb-2">Semplice e trasparente</h2>
          <p className="text-muted-foreground text-center mb-8">Inizia gratis. Passa a Pro quando sei pronto.</p>
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((p, i) => (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`glass-card p-6 relative ${p.popular ? 'ring-2 ring-primary' : ''}`}
              >
                {p.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">Popolare</div>}
                <h3 className="text-xl font-semibold mb-1 uppercase">{p.name}</h3>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-3xl font-bold">{p.price}€</span>
                  <span className="text-muted-foreground text-sm">/mese</span>
                </div>
                <ul className="space-y-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={p.available ? 'hero' : 'outline'}
                  className="w-full mt-6"
                  disabled={!p.available}
                  onClick={() => p.available && navigate('/register')}
                >
                  {p.cta}
                </Button>
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
              <div key={f.q} className="glass-card overflow-hidden">
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
          <h2 className="text-3xl font-bold mb-4">Il tuo studio digitale ti aspetta.</h2>
          <p className="text-muted-foreground mb-8">Crea il tuo account in 2 minuti. Gratis, senza carta di credito.</p>
          <Button variant="hero" size="lg" onClick={() => navigate('/register')}>
            Inizia gratis ora <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      </section>

      {/* Client access */}
      <section className="py-16 px-4 bg-[#f0fdf4]">
        <div className="container mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white">
            <User className="h-6 w-6" />
          </div>
          <h2 className="text-3xl font-bold mb-4 text-emerald-950">Sei un cliente?</h2>
          <p className="text-emerald-900/80 mb-8 text-base md:text-lg leading-relaxed">
            Il tuo personal trainer ti ha inviato un link via email. Usa quel link per creare il tuo account la prima volta.
            Poi torna qui e clicca 'Accedi' per entrare nella tua dashboard.
          </p>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" size="lg" onClick={() => navigate('/login')}>
            Accedi come cliente
          </Button>
        </div>
      </section>

      <footer className="border-t border-border py-8 px-4">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          © 2026 Schedio. Tutti i diritti riservati.
        </div>
      </footer>
    </div>
  );
}
