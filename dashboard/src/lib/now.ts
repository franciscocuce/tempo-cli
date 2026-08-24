import { useEffect, useState } from "react";

// varias pantallas muestran "caído desde hace X". Leer Date.now() en pleno render deja el
// número congelado hasta que otra cosa provoque un render nuevo; con esto el contador avanza solo
export function useNow(everyMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);

  return now;
}
