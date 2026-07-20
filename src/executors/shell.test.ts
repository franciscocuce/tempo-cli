import { describe, it, expect } from "vitest";
import { executeShell } from "./shell.js";

// node -e corre en cualquier plataforma, no dependemos de comandos de windows/linux
describe("executeShell", () => {
  it("devuelve ok y captura stdout cuando el comando sale bien", async () => {
    const result = await executeShell(`node -e "console.log('hola')"`);
    expect(result.status).toBe("ok");
    expect(result.output).toContain("hola");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("devuelve error con el exit code cuando el comando falla", async () => {
    const result = await executeShell(`node -e "process.exit(3)"`);
    expect(result.status).toBe("error");
    expect(result.output).toContain("exit code 3");
  });

  it("captura stderr", async () => {
    const result = await executeShell(`node -e "console.error('algo malo'); process.exit(1)"`);
    expect(result.status).toBe("error");
    expect(result.output).toContain("algo malo");
  });
});
