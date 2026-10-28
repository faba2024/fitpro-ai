import { createBrowserRouter, RouterProvider } from "react-router";
import { AuthProvider } from "./auth";
import { DadosProvider } from "./dados";
import { rotas } from "./rotas";
import { TemaProvider } from "./tema";

const router = createBrowserRouter(rotas);

export function App() {
  return (
    <TemaProvider>
      <AuthProvider>
        <DadosProvider>
          <RouterProvider router={router} />
        </DadosProvider>
      </AuthProvider>
    </TemaProvider>
  );
}
