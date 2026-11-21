import { useId, useState, type CSSProperties } from "react";
import { Heading, Panel, Text } from "@/shared/ui";
import { EDAD_MAX, EDAD_MIN } from "../hooks/useSimulation";
import type { Ocupacion, TwinInput } from "../types";

type Props = { twin: TwinInput; ocupaciones: Ocupacion[]; onChange: (cambio: Partial<TwinInput>) => void };

const campo: CSSProperties = {
  width: "100%",
  minHeight: 44,
  padding: "0 12px",
  border: "1.5px solid var(--control)",
  borderRadius: 12,
  background: "var(--papel)",
  color: "var(--tinta)",
  font: "500 16px/22px var(--font)",
  boxSizing: "border-box",
};
const etiqueta: CSSProperties = { display: "flex", flexDirection: "column", gap: 6, font: "600 14px/20px var(--font)" };
const aviso: CSSProperties = { color: "var(--vida)" };

export function TwinForm({ twin, ocupaciones, onChange }: Props) {
  const id = useId();
  // texto crudo de los campos numéricos, para poder borrar y escribir sin que salte el valor
  const [edadTxt, setEdadTxt] = useState(String(twin.edad));
  const [sueldoTxt, setSueldoTxt] = useState(String(twin.sueldo));

  const edadMala = !(Number.isInteger(twin.edad) && twin.edad >= EDAD_MIN && twin.edad <= EDAD_MAX);
  const sueldoMalo = !(twin.sueldo > 0);

  return (
    <Panel>
      <Heading level={3} as="h2">
        Sobre ti
      </Heading>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <label htmlFor={`${id}-edad`} style={etiqueta}>
          Edad
          <input
            id={`${id}-edad`}
            style={campo}
            type="number"
            inputMode="numeric"
            min={EDAD_MIN}
            max={EDAD_MAX}
            step={1}
            value={edadTxt}
            onChange={(e) => {
              setEdadTxt(e.target.value);
              onChange({ edad: e.target.value === "" ? NaN : Number(e.target.value) });
            }}
          />
          {edadMala && (
            <Text size="sm" style={aviso}>
              Entre {EDAD_MIN} y {EDAD_MAX} años.
            </Text>
          )}
        </label>
        <label htmlFor={`${id}-sueldo`} style={etiqueta}>
          Sueldo líquido mensual (pesos)
          <input
            id={`${id}-sueldo`}
            style={campo}
            type="number"
            inputMode="numeric"
            min={1}
            step={10000}
            value={sueldoTxt}
            onChange={(e) => {
              setSueldoTxt(e.target.value);
              onChange({ sueldo: e.target.value === "" ? NaN : Number(e.target.value) });
            }}
          />
          {sueldoMalo && (
            <Text size="sm" style={aviso}>
              Escribe un monto mayor que cero.
            </Text>
          )}
        </label>
      </div>
      <label htmlFor={`${id}-ocupacion`} style={etiqueta}>
        ¿De qué tipo fue tu último trabajo?
        <select
          id={`${id}-ocupacion`}
          style={campo}
          value={twin.ocupacion}
          disabled={!ocupaciones.length}
          onChange={(e) => onChange({ ocupacion: Number(e.target.value) })}
        >
          {!ocupaciones.length && <option value={twin.ocupacion}>Cargando…</option>}
          {ocupaciones.map((o) => (
            <option key={o.grupo} value={o.grupo}>
              {o.nombre}
            </option>
          ))}
        </select>
      </label>
    </Panel>
  );
}
