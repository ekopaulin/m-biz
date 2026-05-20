import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error("React Error Boundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', backgroundColor: '#fee2e2', color: '#991b1b', minHeight: '100vh', fontFamily: 'sans-serif' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' }}>Oops, une erreur est survenue.</h1>
          <p>L'application a rencontré un problème. Veuillez faire une capture d'écran de ce message et l'envoyer au support.</p>
          <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#fef2f2', borderRadius: '8px', overflowX: 'auto', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
            <strong>Erreur:</strong> {this.state.error && this.state.error.toString()}
            <br /><br />
            <strong>Détails:</strong>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </div>
          <button 
            onClick={() => {
              localStorage.clear();
              sessionStorage.clear();
              window.location.reload();
            }}
            style={{ marginTop: '20px', padding: '10px 15px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}
          >
            Vider le cache et recharger
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
