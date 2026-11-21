import { useRef, useState } from "react";
import { api } from "@/shared/api";
import type { Catalogo, Identidad, Perfil, Prioridades } from "@/shared/types";
import {
  Button,
  ChevronLeftIcon,
  ChipGroup,
  Heading,
  IconButton,
  INDICATORS,
  indicatorColor,
  Panel,
  Pill,
  Screen,
  ScreenFooter,
  ScreenHeader,
  Segmented,
  Slider,
  Stack,
  Text,
  type IndicatorKey,
} from "@/shared/ui";

export type Datos = { perfil: Perfil; prioridades: Prioridades; identidad: Identidad; mundo: string };

const PERFIL_INICIAL: Perfil = {
  edad: 28, sexo: "h", edu: "universitaria", area: "", carrera_id: null, estado: "empleado", tipo_empleador: "pyme", rubro: "",
  nivel: 1, sueldo: 0, antiguedad: 2, ahorro: 0, pareja: "no", hijos: 0, region: "rm", ingles: false, usa_ia: false,
  remoto: false, isapre: false, propietario: false, riesgo: 3,
};

/** Rasgos para quien llena a mano. Los que suben o bajan la tolerancia al riesgo lo dicen. */
const RASGOS_MANUALES: { label: string; riesgo?: number }[] = [
  { label: "Me aburro si no aprendo", riesgo: 1 },
  { label: "Quiero emprender", riesgo: 1 },
  { label: "Me tienta vivir afuera", riesgo: 1 },
  { label: "Cuido mis ahorros", riesgo: -1 },
  { label: "Familia cerca" },
  { label: "Fines de semana sagrados" },
  { label: "Trabajo hasta tarde" },
  { label: "Me gusta liderar" },
];

const KIT_A_API: Record<IndicatorKey, keyof Prioridades> = { dinero: "dinero", carrera: "carrera", bienestar: "bienestar", vida: "vida_personal" };

type Props = { catalogo: Catalogo; inicial: Datos | null; onVolver: () => void; onListo: (d: Datos) => Promise<void> };

export function SobreTi({ catalogo, inicial, onVolver, onListo }: Props) {
  const [fuente, setFuente] = useState<"claude" | "manual">(catalogo.claude ? "claude" : "manual");
  const [perfil, setPerfil] = useState<Perfil>(inicial?.perfil ?? PERFIL_INICIAL);
  const [identidad, setIdentidad] = useState<Identidad>(inicial?.identidad ?? { gemelo_md: "", rasgos: [], politica: [], empresa: "", cargo: "" });
  const [rasgosOn, setRasgosOn] = useState<string[]>(inicial?.identidad.rasgos ?? []);
  const [pesos, setPesos] = useState<Record<IndicatorKey, number>>(() => {
    const p = inicial?.prioridades;
    return p ? { dinero: p.dinero / 10, carrera: p.carrera / 10, bienestar: p.bienestar / 10, vida: p.vida_personal / 10 } : { dinero: 6, carrera: 5, bienestar: 4, vida: 5 };
  });
  const [ciclo, setCiclo] = useState<"estable" | "volatil">((inicial?.mundo.split("_")[0] as "estable") ?? "estable");
  const [tecnologia, setTecnologia] = useState<"parecido" | "digital">((inicial?.mundo.split("_")[1] as "parecido") ?? "parecido");
  const [texto, setTexto] = useState("");
  const [cv, setCv] = useState<File | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const archivo = useRef<HTMLInputElement>(null);

  const total = Object.values(pesos).reduce((a, b) => a + b, 0);
  const pct = (n: number) => `${total > 0 ? Math.round((n / total) * 100) : 0} %`;
  const cambia = <K extends keyof Perfil>(k: K, v: Perfil[K]) => setPerfil((p) => ({ ...p, [k]: v }));
  const trabaja = perfil.estado === "empleado";

  async function leer() {
    setLeyendo(true);
    setError("");
    try {
      const g = await api.leerGemelo(cv, texto);
      setPerfil((p) => {
        const n = { ...p, riesgo: g.riesgo };
        for (const [k, v] of Object.entries(g.perfil)) if (v !== null && v !== undefined) (n as Record<string, unknown>)[k] = v;
        return n;
      });
      setPesos({ dinero: g.prioridades.dinero / 10, carrera: g.prioridades.carrera / 10, bienestar: g.prioridades.bienestar / 10, vida: g.prioridades.vida_personal / 10 });
      setIdentidad({ gemelo_md: g.gemelo_md, rasgos: g.rasgos, politica: g.politica, empresa: (g.empresa ?? "").slice(0, 80), cargo: (g.cargo ?? "").slice(0, 80) });
      setRasgosOn(g.rasgos);
    } catch (e) {
      setError(`Claude no pudo leerte (${e instanceof Error ? e.message : String(e)}). Puedes llenarlo a mano.`);
    } finally {
      setLeyendo(false);
    }
  }

  async function seguir() {
    setError("");
    if (!perfil.sueldo) return setError(trabaja ? "Falta tu sueldo líquido." : "Falta tu último sueldo líquido.");
    if (perfil.tipo_empleador !== "publico" && !perfil.rubro) return setError("Falta el rubro.");
    if (total <= 0) return setError("Reparte al menos un punto entre lo que te importa.");
    const manuales = fuente === "manual";
    const riesgo = manuales
      ? Math.min(5, Math.max(1, 3 + RASGOS_MANUALES.filter((r) => rasgosOn.includes(r.label)).reduce((s, r) => s + (r.riesgo ?? 0), 0)))
      : perfil.riesgo;
    const prioridades = Object.fromEntries(INDICATORS.map(({ key }) => [KIT_A_API[key], Math.round((pesos[key] / total) * 100)])) as Prioridades;
    setEnviando(true);
    try {
      await onListo({
        perfil: { ...perfil, riesgo, area: perfil.edu === "media" ? "" : perfil.area },
        prioridades,
        identidad: { ...identidad, rasgos: rasgosOn },
        mundo: `${ciclo}_${tecnologia}`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setEnviando(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader
        left={
          <IconButton label="Volver al inicio" onClick={onVolver}>
            <ChevronLeftIcon />
          </IconButton>
        }
        right={<Pill>Sobre ti</Pill>}
      />
      <Stack>
        <Heading level={1}>Cuéntanos de ti.</Heading>
        <Text>Con esto armamos a tu gemelo. Las decisiones las tomas tú.</Text>
      </Stack>

      {catalogo.claude && (
        <Segmented
          label="Cómo nos cuentas de ti"
          value={fuente}
          onChange={setFuente}
          options={[
            { value: "claude", label: "Mi Claude ya sabe" },
            { value: "manual", label: "Lo lleno yo" },
          ]}
        />
      )}

      {fuente === "claude" ? (
        <Panel>
          <Stack gap={4}>
            <Heading level={3} as="h2">
              {identidad.gemelo_md ? "Esto dice tu agente de ti" : "Pégale lo que tu Claude sabe de ti"}
            </Heading>
            <Text size="sm">
              {identidad.gemelo_md
                ? "Desmarca lo que no quieras usar. Tus gemelos van a decidir como tú."
                : "Pídele a tu Claude «describe mi vida laboral, qué me importa y cómo decido» y pega la respuesta. O sube tu CV."}
            </Text>
          </Stack>
          {identidad.gemelo_md ? (
            <>
              <Text size="sm">{identidad.gemelo_md}</Text>
              <ChipGroup options={identidad.rasgos.map((r) => ({ value: r, label: r }))} selected={rasgosOn} onChange={setRasgosOn} />
              <Button variant="quiet" onClick={() => setIdentidad({ ...identidad, gemelo_md: "", rasgos: [] })}>
                Volver a contarle
              </Button>
            </>
          ) : (
            <>
              <label className="vd-campo">
                <span>Lo que sabe de ti</span>
                <textarea value={texto} maxLength={20000} onChange={(e) => setTexto(e.target.value)} placeholder="Soy ingeniera, llevo dos años en una fintech. Me aburro rápido si no aprendo…" />
              </label>
              <input ref={archivo} type="file" accept="application/pdf,text/plain,.pdf,.txt,.md" hidden onChange={(e) => setCv(e.target.files?.[0] ?? null)} />
              <Button variant="white" onClick={() => archivo.current?.click()}>
                {cv ? `CV: ${cv.name}` : "Subir CV o LinkedIn en PDF"}
              </Button>
              <Button onClick={leer} disabled={leyendo || (!cv && !texto.trim())}>
                {leyendo ? "Tu agente está leyendo…" : "Armar mi gemelo"}
              </Button>
              {leyendo && <span className="vd-espera">Toma unos 20 segundos. Nada se guarda.</span>}
            </>
          )}
        </Panel>
      ) : (
        <Panel>
          <Stack gap={4}>
            <Heading level={3} as="h2">
              Marca lo que se parece a ti
            </Heading>
            <Text size="sm">Con tres o cuatro ya alcanza para empezar.</Text>
          </Stack>
          <ChipGroup options={RASGOS_MANUALES.map((r) => ({ value: r.label, label: r.label }))} selected={rasgosOn} onChange={setRasgosOn} />
        </Panel>
      )}

      <Stack as="section" gap={10}>
        <Stack gap={4}>
          <Heading level={3} as="h2">
            Dónde estás hoy
          </Heading>
          <Text size="sm">{identidad.gemelo_md ? "Lo llenó tu agente. Corrige lo que no calce." : "Lo justo para que el simulador parta desde tu vida."}</Text>
        </Stack>
        <div className="vd-campos">
          <label className="vd-campo">
            <span>Edad</span>
            <input type="number" min={20} max={50} value={perfil.edad} onChange={(e) => cambia("edad", Number(e.target.value))} />
          </label>
          <label className="vd-campo">
            <span>Sexo registrado</span>
            <select value={perfil.sexo} onChange={(e) => cambia("sexo", e.target.value as Perfil["sexo"])}>
              <option value="h">Hombre</option>
              <option value="m">Mujer</option>
            </select>
          </label>
          <label className="vd-campo">
            <span>Estudios</span>
            <select value={perfil.edu} onChange={(e) => cambia("edu", e.target.value as Perfil["edu"])}>
              <option value="media">Media</option>
              <option value="tecnica">Técnica</option>
              <option value="universitaria">Universitaria</option>
              <option value="postgrado">Postgrado</option>
            </select>
          </label>
          <label className="vd-campo">
            <span>Ahora</span>
            <select value={perfil.estado} onChange={(e) => cambia("estado", e.target.value as Perfil["estado"])}>
              <option value="empleado">Trabajo</option>
              <option value="buscando">Busco pega</option>
            </select>
          </label>
          <label className="vd-campo">
            <span>{trabaja ? "Dónde" : "Dónde estabas"}</span>
            <select value={perfil.tipo_empleador ?? "pyme"} onChange={(e) => cambia("tipo_empleador", e.target.value as Perfil["tipo_empleador"])}>
              <option value="grande">Empresa grande</option>
              <option value="pyme">Pyme</option>
              <option value="startup">Startup</option>
              <option value="publico">El Estado</option>
              <option value="extranjero">Remoto afuera</option>
            </select>
          </label>
          {perfil.tipo_empleador !== "publico" && (
            <label className="vd-campo">
              <span>Rubro</span>
              <select value={perfil.rubro} onChange={(e) => cambia("rubro", e.target.value)}>
                <option value="">Elige</option>
                {catalogo.rubros.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
          )}
          <label className="vd-campo">
            <span>Cargo</span>
            <input type="text" maxLength={80} placeholder="Analista" value={identidad.cargo} onChange={(e) => setIdentidad({ ...identidad, cargo: e.target.value })} />
          </label>
          <label className="vd-campo">
            <span>{trabaja ? "Empresa" : "Última empresa"}</span>
            <input type="text" maxLength={80} placeholder="Opcional" value={identidad.empresa} onChange={(e) => setIdentidad({ ...identidad, empresa: e.target.value })} />
          </label>
          <label className="vd-campo">
            <span>{trabaja ? "Sueldo líquido" : "Último sueldo"}</span>
            <input type="number" min={0} step={50000} placeholder="1500000" value={perfil.sueldo || ""} onChange={(e) => cambia("sueldo", Number(e.target.value))} />
          </label>
          <label className="vd-campo">
            <span>Ahorros</span>
            <input type="number" step={500000} value={perfil.ahorro || ""} placeholder="0" onChange={(e) => cambia("ahorro", Number(e.target.value))} />
          </label>
        </div>
      </Stack>

      <Stack as="section" gap={10}>
        <Stack gap={4}>
          <Heading level={3} as="h2">
            Reparte lo que te importa
          </Heading>
          <Text size="sm">Con esto medimos tu felicidad al final: qué tan cerca quedó tu vida de lo que elegiste aquí.</Text>
        </Stack>
        <Stack gap={6}>
          {INDICATORS.map(({ key, label }) => (
            <Slider key={key} label={label} value={pesos[key]} onChange={(n) => setPesos((p) => ({ ...p, [key]: n }))} color={indicatorColor(key)} display={pct(pesos[key])} />
          ))}
        </Stack>
      </Stack>

      <Stack as="section" gap={10}>
        <Stack gap={4}>
          <Heading level={3} as="h2">
            ¿Cómo viene el mundo?
          </Heading>
          <Text size="sm">Juegas en el que crees más probable. Al final te mostramos tu camino en los cuatro.</Text>
        </Stack>
        <Segmented
          label="Economía"
          value={ciclo}
          onChange={setCiclo}
          options={[
            { value: "estable", label: "Pocas crisis" },
            { value: "volatil", label: "Crisis seguidas" },
          ]}
        />
        <Segmented
          label="Tecnología"
          value={tecnologia}
          onChange={setTecnologia}
          options={[
            { value: "parecido", label: "Todo parecido" },
            { value: "digital", label: "La IA lo cambia" },
          ]}
        />
      </Stack>

      {error && (
        <Text size="sm" style={{ color: "var(--vida)" }} role="alert">
          {error}
        </Text>
      )}
      <ScreenFooter>
        <Button onClick={seguir} disabled={enviando || leyendo}>
          {enviando ? "Armando tu carrera…" : "Empezar mi carrera"}
        </Button>
      </ScreenFooter>
    </Screen>
  );
}
