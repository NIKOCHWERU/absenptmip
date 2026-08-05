import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient.js";
import App from "./App.js";
import "./index.css";

// Dynamic Theme Injection from environment variables (.env)
const injectTheme = () => {
  const root = document.documentElement;

  const primary = import.meta.env.VITE_THEME_PRIMARY_HSL;
  const secondary = import.meta.env.VITE_THEME_SECONDARY_HSL;
  const accent = import.meta.env.VITE_THEME_ACCENT_HSL;
  const background = import.meta.env.VITE_THEME_BACKGROUND_HSL;
  const sidebarAccent = import.meta.env.VITE_THEME_SIDEBAR_ACCENT_HSL;

  if (primary) root.style.setProperty("--primary", primary);
  if (secondary) root.style.setProperty("--secondary", secondary);
  if (accent) root.style.setProperty("--accent", accent);
  if (background) root.style.setProperty("--background", background);
  if (sidebarAccent) root.style.setProperty("--sidebar-accent", sidebarAccent);
  
  // Set matching ring focus color
  if (primary) root.style.setProperty("--ring", primary);
};

injectTheme();

class GlobalErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("[React Global ErrorBoundary caught error]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', padding: '20px', fontFamily: 'sans-serif' }}>
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', maxWidth: '400px', width: '100%', textAlign: 'center', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px' }}>Terjadi Kendala Tampilan</h2>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>Aplikasi menemukan masalah tak terduga saat memuat data.</p>
            <div style={{ backgroundColor: '#f1f5f9', borderRadius: '8px', padding: '8px 12px', fontSize: '10px', color: '#dc2626', fontFamily: 'monospace', marginBottom: '16px', textAlign: 'left', overflowX: 'auto', maxHeight: '100px' }}>
              {this.state.error?.message || String(this.state.error)}
            </div>
            <button
              onClick={() => { window.location.href = "/"; }}
              style={{ backgroundColor: '#f97316', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', width: '100%' }}
            >
              Muat Ulang Aplikasi
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </GlobalErrorBoundary>
  </React.StrictMode>
);
