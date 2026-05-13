import { useState } from 'react';
import Model, { IMuscleStats, Muscle } from 'react-body-highlighter';

const MUSCLE_LABELS: Record<string, string> = {
  trapezius: 'Trapezi',
  'upper-back': 'Dorsali superiori',
  'lower-back': 'Lombari',
  chest: 'Pettorali',
  biceps: 'Bicipiti',
  triceps: 'Tricipiti',
  forearm: 'Avambracci',
  'back-deltoids': 'Deltoidi (post)',
  'front-deltoids': 'Deltoidi (ant)',
  abs: 'Addominali',
  obliques: 'Obliqui',
  adductor: 'Adduttori',
  abductors: 'Abduttori',
  hamstring: 'Femorali',
  quadriceps: 'Quadricipiti',
  calves: 'Polpacci',
  gluteal: 'Glutei',
  head: 'Testa',
  neck: 'Collo'
};

export function getMuscleLabel(id: string): string {
  return MUSCLE_LABELS[id] ?? id;
}

export const ALL_MUSCLES = Object.keys(MUSCLE_LABELS);

export type MacroArea = 'upper' | 'lower' | 'full' | null;

export const MACRO_AREAS_MUSCLES: Record<string, string[]> = {
  upper: ['trapezius', 'upper-back', 'lower-back', 'chest', 'biceps', 'triceps', 'forearm', 'back-deltoids', 'front-deltoids', 'abs', 'obliques', 'head', 'neck'],
  lower: ['adductor', 'abductors', 'hamstring', 'quadriceps', 'calves', 'gluteal'],
  full: ALL_MUSCLES
};

interface MuscleSelectorProps {
  selected: string[];
  onChange: (selected: string[]) => void;
  macroArea?: MacroArea;
  onMacroAreaChange?: (area: MacroArea) => void;
  readOnly?: boolean;
  className?: string;
}

export function MuscleSelector({ selected, onChange, macroArea, onMacroAreaChange, readOnly = false, className = '' }: MuscleSelectorProps) {
  const toggle = (muscleId: string) => {
    if (readOnly) return;
    onChange(
      selected.includes(muscleId)
        ? selected.filter(s => s !== muscleId)
        : [...selected, muscleId]
    );
  };

  const handleMuscleClick = (stats: IMuscleStats) => {
    if (stats.muscle) {
      toggle(stats.muscle);
    }
  };

  // If specific muscles are selected, show those. Otherwise show the macro area if selected.
  const highlightedMuscles = selected.length > 0 
    ? selected 
    : (macroArea ? MACRO_AREAS_MUSCLES[macroArea] : []);

  const data = highlightedMuscles.length > 0 ? [
    {
      name: 'Selection',
      muscles: highlightedMuscles as Muscle[],
      frequency: 1
    }
  ] : [];

  return (
    <div className={`space-y-4 ${className}`}>
      
      {/* Macro Area Selection */}
      {!readOnly && onMacroAreaChange && (
        <div className="flex gap-2 p-1 bg-muted/50 rounded-lg w-fit mb-4">
          <button
            onClick={() => { onMacroAreaChange('upper'); onChange([]); }}
            className={`text-xs px-3 py-1.5 rounded-md transition-colors ${macroArea === 'upper' ? 'bg-white shadow-sm font-semibold' : 'text-muted-foreground hover:bg-white/50'}`}
          >
            Parte alta
          </button>
          <button
            onClick={() => { onMacroAreaChange('lower'); onChange([]); }}
            className={`text-xs px-3 py-1.5 rounded-md transition-colors ${macroArea === 'lower' ? 'bg-white shadow-sm font-semibold' : 'text-muted-foreground hover:bg-white/50'}`}
          >
            Parte bassa
          </button>
          <button
            onClick={() => { onMacroAreaChange('full'); onChange([]); }}
            className={`text-xs px-3 py-1.5 rounded-md transition-colors ${macroArea === 'full' ? 'bg-white shadow-sm font-semibold' : 'text-muted-foreground hover:bg-white/50'}`}
          >
            Tutto il corpo
          </button>
        </div>
      )}

      {/* Specific Labels strip */}
      {!readOnly && (
        <div className="flex flex-wrap gap-1.5">
          {ALL_MUSCLES.map(muscleId => {
            const isSelected = selected.includes(muscleId);
            return (
              <button
                key={muscleId}
                onClick={() => toggle(muscleId)}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors
                  ${isSelected
                    ? 'bg-emerald-500 border-emerald-500 text-white font-semibold'
                    : 'bg-muted border-border text-muted-foreground hover:border-primary/50'}`}
              >
                {getMuscleLabel(muscleId)}
              </button>
            );
          })}
        </div>
      )}

      {/* Body Model */}
      <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
        <div className="flex flex-col items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Fronte</span>
          <Model
            type="anterior"
            data={data}
            onClick={readOnly ? undefined : handleMuscleClick as any}
            highlightedColors={['#10b981']}
            style={{ width: '12rem', cursor: readOnly ? 'default' : 'pointer' }}
          />
        </div>
        <div className="flex flex-col items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Retro</span>
          <Model
            type="posterior"
            data={data}
            onClick={readOnly ? undefined : handleMuscleClick as any}
            highlightedColors={['#10b981']}
            style={{ width: '12rem', cursor: readOnly ? 'default' : 'pointer' }}
          />
        </div>
      </div>

      {/* Selection summary */}
      {selected.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-emerald-600">
            {selected.length} muscol{selected.length === 1 ? 'o' : 'i'} selezionat{selected.length === 1 ? 'o' : 'i'}:{' '}
          </span>
          {selected.map(getMuscleLabel).join(', ')}
        </div>
      )}
    </div>
  );
}
