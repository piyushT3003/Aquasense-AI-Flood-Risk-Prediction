import React, { Component, ErrorInfo, ReactNode, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, error: null };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("AquaSense Uncaught Error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-white text-center">
          <div className="max-w-md bg-slate-900/90 border border-rose-500/40 rounded-2xl p-6 shadow-2xl backdrop-blur-xl space-y-4">
            <h2 className="text-xl font-bold text-rose-400">AquaSense Early Warning</h2>
            <p className="text-xs text-slate-300">{this.state.error?.message || "An issue occurred rendering the interface."}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-xs transition-colors"
            >
              Refresh Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
