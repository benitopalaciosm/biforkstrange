import { SimulationPage } from "@/features/simulation";
import { UiKitPage } from "@/features/ui-kit";

export default function App() {
  // Catálogo del kit de UI en /ui (sin router por ahora)
  if (window.location.pathname.startsWith("/ui")) return <UiKitPage />;

  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 720, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>Agarrar la pala</h1>
      <p>
        <a href="/ui">Ver el kit de UI</a>
      </p>
      <SimulationPage />
    </main>
  );
}
