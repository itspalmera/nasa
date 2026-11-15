// frontend/components/layout/copilot-drawer.tsx
'use client';

import {useT} from '../../src/i18n/useT';
import React from 'react';
import { X } from 'lucide-react';
import { RagCopilotWorkspace } from '../../src/components/copilot/RagCopilotWorkspace';

interface CopilotDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function CopilotDrawer({ open, onClose }: CopilotDrawerProps) {
  const t = useT();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/65 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t("Copiloto Científico SI")}
        className="relative flex h-full w-full max-w-lg flex-col border-l border-slate-800 bg-[#0A1224] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("Cerrar panel Copilot")}
          className="absolute right-3 top-3 z-20 rounded-lg border border-slate-700/80 bg-slate-900/90 p-1.5 text-slate-300 transition hover:bg-slate-800 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Componente unificado que maneja el streaming, citas y validaciones del backend */}
        <RagCopilotWorkspace variant="drawer" onCloseDrawer={onClose} />
      </aside>
    </div>
  );
}