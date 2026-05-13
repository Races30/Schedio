import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { SessionFeedback } from '@/types';
import { AlertCircle, Star, Zap } from 'lucide-react';

interface SessionFeedbackModalProps {
  open: boolean;
  onClose: () => void;
  feedback: SessionFeedback | null;
  clientName?: string;
  sessionDate?: string | null;
}

function EnergyEmojis({ level }: { level: number }) {
  const emojis = Array.from({ length: level }).map(() => '⚡');
  return <span className="text-sm">{emojis.join('')}</span>;
}

function StarRating({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex gap-0.5 text-lg leading-none">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={i <= rating ? 'text-amber-400' : 'text-muted'}>★</span>
      ))}
    </div>
  );
}

export function SessionFeedbackModal({ open, onClose, feedback, clientName, sessionDate }: SessionFeedbackModalProps) {
  if (!feedback) return null;

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            Feedback Sessione
          </DialogTitle>
          <DialogDescription>
            {clientName ? `Feedback lasciato da ${clientName}` : 'Dettagli feedback'}
            {sessionDate && ` il ${new Date(sessionDate).toLocaleDateString('it-IT')}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/40 p-4 rounded-xl flex flex-col items-center justify-center text-center gap-2">
              <span className="text-sm text-muted-foreground">Livello Energia</span>
              <EnergyEmojis level={feedback.energy_level} />
            </div>
            <div className="bg-muted/40 p-4 rounded-xl flex flex-col items-center justify-center text-center gap-2">
              <span className="text-sm text-muted-foreground">Valutazione</span>
              <StarRating rating={feedback.overall_rating} />
            </div>
          </div>

          <div className="space-y-4 border-t border-border pt-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Stato di stanchezza</span>
              {feedback.was_tired ? (
                <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-3 py-1 rounded-full font-medium">😴 Stanco</span>
              ) : (
                <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-3 py-1 rounded-full font-medium">✅ Riposato</span>
              )}
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Difficoltà riscontrate</span>
              {feedback.had_difficulty ? (
                <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-3 py-1 rounded-full font-medium flex items-center gap-1">
                  ⚠️ Difficoltà
                </span>
              ) : (
                <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-3 py-1 rounded-full font-medium">
                  ✅ Nessuna difficoltà
                </span>
              )}
            </div>

            {feedback.difficulty_notes && (
              <div className="mt-2 bg-muted/50 p-3 rounded-lg border border-border">
                <span className="text-xs font-semibold text-muted-foreground block mb-1">Note del cliente:</span>
                <p className="text-sm italic">"{feedback.difficulty_notes}"</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
