import { Component, ErrorInfo, ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import App from './App.tsx';
import { LanguageProvider } from './context/LanguageContext';
import './index.css';

// Interface for ErrorBoundary state
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

// Global visual error boundary to prevent blank screens in production/GitHub Pages
class GlobalErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error?.message || 'Erreur inattendue du studio 3D' };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Eya3D Error Boundary]:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-[#090A0C] text-slate-200 flex flex-col items-center justify-center p-6 select-none">
          <div className="max-w-md w-full bg-[#161920] border border-[#2D3139] rounded-xl p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4 text-red-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-white mb-2 tracking-tight">Erreur d'Initialisation Graphique</h2>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Une anomalie est survenue lors de l'initialisation du moteur WebGL.
            </p>
            <div className="w-full bg-[#0d0f14] border border-[#252830] rounded p-3 mb-5 text-left font-mono text-[11px] text-red-300 break-words max-h-28 overflow-y-auto">
              {this.state.errorMessage}
            </div>
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Recharger l'application</span>
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
    <GlobalErrorBoundary>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </GlobalErrorBoundary>
  </StrictMode>,
);


