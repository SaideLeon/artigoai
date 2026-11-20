"use client";

import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
};

export default class FirebaseErrorBoundary extends React.Component<
  Props,
  State
> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    let displayMsg =
      "Ocorreu um erro inesperado ao sincronizar os seus dados.";
    try {
      const parsed = JSON.parse(error.message);
      if (parsed?.error) {
        displayMsg = `Não foi possível concluir a operação (${parsed.operationType ?? "dados"}). Tente novamente.`;
      }
    } catch {
      if (error?.message) {
        displayMsg = error.message;
      }
    }
    return { hasError: true, message: displayMsg };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[280px] items-center justify-center p-6">
          <div className="max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm dark:border-rose-900/50 dark:bg-slate-900">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Algo correu mal na sincronização
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: "" })}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Tentar novamente</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
