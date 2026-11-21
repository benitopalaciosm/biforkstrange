import { useEffect, useId, useRef, useState } from "react";
import { Button, Heading, Panel, Row, Stack, Tag, Text } from "@/shared/ui";
import { TEXTO_MAX, getPrompt } from "../api";
import { Cargando } from "./piezas";

export type EstadoLectura =
  | { fase: "nada" }
  | { fase: "leyendo"; documento: boolean }
  | { fase: "listo"; inferido: string[]; supuestos: string[]; avisos: string[]; documento: boolean; duda: string | null }
  | { fase: "error"; status: number; detalle: string };

/**
 * Tu perfil armado por tu Claude. Tu Claude ya te conoce (memorias, conversaciones): le pegas el prompt,
 * te arma el documento y lo traes aquí. El formulario de abajo queda lleno y lo puedes corregir.
 * Es opcional. El archivo se lee en el navegador; al servidor solo viaja el texto.
 */
export function Trayectoria({ estado, onLlenar }: { estado: EstadoLectura; onLlenar: (texto: string) => void }) {
  const [prompt, setPrompt] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<"si" | "no" | null>(null);
  const [texto, setTexto] = useState("");
  const [archivo, setArchivo] = useState<string | null>(null);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const idTexto = useId();
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let vivo = true;
    getPrompt()
      .then((r) => vivo && setPrompt(r.prompt))
      .catch(() => vivo && setPrompt(null));
    return () => {
      vivo = false;
    };
  }, []);

  const copiar = async () => {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiado("si");
    } catch {
      setCopiado("no"); // sin permiso de portapapeles: se muestra para copiarlo a mano
    }
  };

  const largo = texto.trim().length;
  const muyLargo = largo > TEXTO_MAX;
  const leyendo = estado.fase === "leyendo";

  const subir = (f: File | undefined) => {
    if (!f) return;
    setErrorArchivo(null);
    if (!/\.(md|txt|markdown)$/i.test(f.name) && !f.type.startsWith("text/")) {
      setErrorArchivo("Ese archivo no es de texto. Sube un .md o un .txt, o pega el texto.");
      return;
    }
    const lector = new FileReader();
    lector.onload = () => {
      setTexto(typeof lector.result === "string" ? lector.result : "");
      setArchivo(f.name);
    };
    lector.onerror = () => setErrorArchivo("No pudimos leer el archivo. Prueba pegando el texto.");
    lector.readAsText(f);
  };

  return (
    <Panel>
      <Stack gap={4}>
        <Row gap={8} style={{ alignItems: "center" }}>
          <Heading level={3} as="h2">
            Arma tu perfil con tu Claude
          </Heading>
          <Tag>Opcional</Tag>
        </Row>
        <Text size="sm">
          Tu Claude ya te conoce. Pégale este prompt y te arma tu perfil; si le falta algo, te pregunta. Después trae aquí lo que te respondió. Si
          prefieres, llena el formulario de abajo a mano.
        </Text>
      </Stack>

      <Stack gap={8}>
        <Text size="sm">
          <strong>1. Copia el prompt y pégalo en tu Claude</strong> (claude.ai, la app o Claude Code).
        </Text>
        <Row gap={8} style={{ alignItems: "center", flexWrap: "wrap" }}>
          <Button variant="quiet" onClick={() => void copiar()} disabled={!prompt}>
            {prompt ? "Copiar el prompt" : "Cargando el prompt…"}
          </Button>
          {copiado === "si" && <span className="jg-chico" role="status">Copiado. Pégalo en tu Claude.</span>}
          {copiado === "no" && <span className="jg-chico" role="status">No pudimos copiarlo: ábrelo abajo y cópialo a mano.</span>}
        </Row>
        {prompt && (
          <details className="jg-plegable" open={copiado === "no"}>
            <summary>Ver el prompt</summary>
            <textarea className="jg-campo jg-texto" readOnly rows={8} value={prompt} onFocus={(e) => e.currentTarget.select()} />
          </details>
        )}
      </Stack>

      <Stack gap={8}>
        <Text size="sm">
          <label htmlFor={idTexto}>
            <strong>2. Pega aquí lo que te respondió tu Claude</strong>, o sube el archivo.
          </label>
        </Text>
        <textarea
          id={idTexto}
          className="jg-campo jg-texto"
          rows={6}
          placeholder={"```gemelo-laboral\nedad: 33\n…"}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setArchivo(null);
          }}
        />
        <input
          ref={entrada}
          type="file"
          accept=".md,.txt,.markdown,text/plain,text/markdown"
          hidden
          onChange={(e) => {
            subir(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {archivo && <span className="jg-chico">Cargamos «{archivo}» aquí arriba. Se lee en tu navegador; el archivo no se sube.</span>}
        {errorArchivo && (
          <div className="jg-error" role="alert">
            {errorArchivo}
          </div>
        )}
        {muyLargo && (
          <div className="jg-error" role="alert">
            El texto tiene {largo.toLocaleString("es-CL")} caracteres y el máximo es {TEXTO_MAX.toLocaleString("es-CL")}. Acórtalo.
          </div>
        )}
      </Stack>

      <Stack gap={10}>
        <Button onClick={() => onLlenar(texto.trim())} disabled={largo === 0 || muyLargo || leyendo}>
          {leyendo ? "Leyendo…" : "Llenar mi perfil"}
        </Button>
        <Button variant="quiet" onClick={() => entrada.current?.click()} disabled={leyendo}>
          Subir un archivo .md o .txt
        </Button>
      </Stack>

      {leyendo && !estado.documento && (
        <Cargando>
          Esto no viene en el formato del prompt, así que Claude lo está leyendo como texto libre. Puede tardar hasta un minuto; mientras, puedes ir
          llenando el formulario.
        </Cargando>
      )}

      {estado.fase === "error" && (
        <div className="jg-error" role="alert">
          {estado.status === 503
            ? `No pudimos leer ese texto: no viene en el formato del prompt y Claude no está disponible para leerlo libre. ${estado.detalle} Pega la respuesta de tu Claude tal cual, o llena el formulario a mano.`
            : estado.status === 422
              ? `No pudimos usar ese texto. ${estado.detalle}`
              : `No pudimos hablar con el simulador. ${estado.detalle} Puedes llenar el formulario a mano.`}
        </div>
      )}

      {estado.fase === "listo" && (
        <Stack gap={8} role="status">
          <Text size="sm">
            <strong>Listo: llenamos el formulario con {estado.documento ? "el perfil que armó tu Claude" : "tu texto"}.</strong>{" "}
            {estado.supuestos.length > 0
              ? `No decía: ${estado.supuestos.join(", ")}. Ahí pusimos un valor típico y lo marcamos para que lo revises.`
              : "Revísalo y corrige lo que no calce."}
            {estado.duda ? " También trajo tu duda: la vas a ver primera en la pantalla siguiente." : ""}
          </Text>
          {estado.avisos.length > 0 && (
            <ul className="jg-error">
              {estado.avisos.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          )}
          {estado.inferido.length > 0 && (
            <details className="jg-plegable">
              <summary>Qué dedujo tu Claude y de dónde</summary>
              <ul>
                {estado.inferido.map((frase, i) => (
                  <li key={i}>{frase}</li>
                ))}
              </ul>
            </details>
          )}
        </Stack>
      )}
    </Panel>
  );
}
