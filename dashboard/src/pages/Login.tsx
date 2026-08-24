import { useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth.js";
import { Button, Field } from "../components/ui.js";

export function Login() {
  const { signIn, signUp, setupNeeded } = useAuth();

  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      if (setupNeeded) {
        await signUp(token, email, password);
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo entrar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-2xl font-semibold tracking-tight">
            tempo<span className="text-accent">.</span>
          </p>
          <p className="mt-1 text-sm text-dim">
            {setupNeeded ? "Creá el primer usuario" : "Monitor de uptime"}
          </p>
        </div>

        <form
          onSubmit={(event) => void submit(event)}
          className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5"
        >
          {setupNeeded && (
            <>
              <p className="rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-dim">
                Copiá el token de alta que tempo imprimió en la consola al arrancar.
              </p>
              <Field
                label="Token de alta"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                autoComplete="off"
                required
              />
            </>
          )}

          <Field
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            required
          />

          <Field
            label="Contraseña"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={setupNeeded ? "new-password" : "current-password"}
            hint={setupNeeded ? "Mínimo 10 caracteres" : undefined}
            required
          />

          {error !== null && (
            <p role="alert" className="text-sm text-down">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Entrando…" : setupNeeded ? "Crear usuario" : "Entrar"}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-dim">
          <a href="/status" className="hover:text-ink">
            Ver el status público
          </a>
        </p>
      </div>
    </div>
  );
}
