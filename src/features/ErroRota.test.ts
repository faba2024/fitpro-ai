import { describe, expect, it } from "vitest";
import { ehVersaoAntiga } from "./ErroRota";

describe("erro de versão antiga", () => {
  it("reconhece as mensagens dos navegadores para arquivo de rota que sumiu", () => {
    expect(ehVersaoAntiga(new TypeError("Failed to fetch dynamically imported module: https://x/assets/Gestao-abc.js"))).toBe(true);
    expect(ehVersaoAntiga(new TypeError("Importing a module script failed."))).toBe(true);
    expect(ehVersaoAntiga(new TypeError("error loading dynamically imported module"))).toBe(true);
    expect(ehVersaoAntiga(new Error("Cannot read properties of undefined"))).toBe(false);
    expect(ehVersaoAntiga("texto")).toBe(false);
  });
});
