import { createBrowserRouter, RouterProvider } from "react-router";
import { AcademiaProvider } from "./academia";
import { AuthProvider } from "./auth";
import { DadosProvider } from "./dados";
import { rotas } from "./rotas";
import { TemaProvider } from "./tema";
import { TreinoProvider } from "./treinoAtivo";

const router = createBrowserRouter(rotas);

export function App() {
  return (
    <TemaProvider>
      <AuthProvider>
        <DadosProvider>
          <AcademiaProvider>
            <TreinoProvider>
              <RouterProvider router={router} />
            </TreinoProvider>
          </AcademiaProvider>
        </DadosProvider>
      </AuthProvider>
    </TemaProvider>
  );
}
