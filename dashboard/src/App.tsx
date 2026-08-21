import { useCallback, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth.js";
import { ToastProvider } from "./lib/toast.js";
import { useEventStream } from "./lib/events.js";
import { Layout } from "./components/Layout.js";
import { Spinner } from "./components/ui.js";
import { Login } from "./pages/Login.js";
import { Overview } from "./pages/Overview.js";
import { MonitorDetail } from "./pages/MonitorDetail.js";
import { Incidents } from "./pages/Incidents.js";
import { Settings } from "./pages/Settings.js";
import { Status } from "./pages/Status.js";

function Private() {
  const { user, loading } = useAuth();

  // cada evento del servidor bump-ea la clave y las pantallas se vuelven a pedir:
  // es más simple que mantener un cache y no puede quedar desincronizado
  const [reloadKey, setReloadKey] = useState(0);
  const bump = useCallback(() => setReloadKey((current) => current + 1), []);
  const connected = useEventStream(bump);

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <Spinner label="Abriendo tempo" />
      </div>
    );
  }

  if (user === null) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Layout connected={connected}>
      <Routes>
        <Route path="/" element={<Overview reloadKey={reloadKey} />} />
        <Route path="/monitors/:id" element={<MonitorDetail reloadKey={reloadKey} />} />
        <Route path="/incidents" element={<Incidents reloadKey={reloadKey} />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

function LoginRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }
  return user === null ? <Login /> : <Navigate to="/" replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/status" element={<Status />} />
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/*" element={<Private />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
