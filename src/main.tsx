import {StrictMode, Component, ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Unregister any old service workers that might be causing "usa una version anterior"
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister();
    } 
  });
}

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean; error: Error | null}> {
  public state: {hasError: boolean; error: Error | null};
  public props: {children: ReactNode};

  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
    this.props = props;
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'Error desconocido';
      let displayMessage = errorMessage;
      try {
        // If it's the JSON from handleFirestoreError, pretty print it
        const parsed = JSON.parse(errorMessage);
        displayMessage = JSON.stringify(parsed, null, 2);
      } catch (e) {
        // Not JSON, just use raw string
      }

      return (
        <div style={{ padding: '20px', color: 'red', backgroundColor: '#fee', height: '100vh', overflow: 'auto' }}>
          <h2 style={{ marginBottom: '10px' }}>Algo salió mal en la aplicación.</h2>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', backgroundColor: '#fff', padding: '10px', border: '1px solid #ccc' }}>
            {displayMessage}
          </pre>
          <button 
            onClick={() => window.location.reload()} 
            style={{ marginTop: '20px', padding: '10px 20px', cursor: 'pointer', backgroundColor: '#00FF00', border: 'none', fontWeight: 'bold' }}
          >
            RECARGAR APLICACIÓN
          </button>
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
);
