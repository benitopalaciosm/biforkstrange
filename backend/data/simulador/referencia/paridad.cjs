// Compara el evaluador JavaScript con los resultados de Python (ver paridad.py).
const fs = require('fs'), path = require('path');
const X = require('./expresiones.js');
const raiz = path.join(__dirname, '..');
function leerCSV(ruta) {
  const txt = fs.readFileSync(ruta, 'utf8').replace(/\r/g, ''), filas = [];
  let fila = [], campo = '', comillas = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (comillas) { if (c === '"' && txt[i + 1] === '"') { campo += '"'; i++; } else if (c === '"') comillas = false; else campo += c; }
    else if (c === '"') comillas = true; else if (c === ',') { fila.push(campo); campo = ''; } else if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; } else campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  const cab = filas.shift(); return filas.filter((f) => f.length === cab.length).map((f) => Object.fromEntries(cab.map((c, i) => [c, f[i]])));
}
const parametros = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(raiz, 'parametros.json'), 'utf8')).parametros.map((p) => [p.id, p.valor]));
const indice = JSON.parse(fs.readFileSync(path.join(raiz, 'tablas', 'indice.json'), 'utf8')).tablas;
const tablas = Object.fromEntries(indice.map((t) => [t.tabla, leerCSV(path.join(raiz, t.archivo))]));
const ev = X.crear({ parametros, tablas });
const { estados, casos } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
let ok = 0; const malos = [];
for (const [i, expr, esperado] of casos) {
  let v; try { v = ev.evaluar(expr, estados[i]); } catch (e) { v = '__error__'; }
  const igual = typeof esperado === 'number' && typeof v === 'number' ? Math.abs(v - esperado) <= 1e-9 * Math.max(1, Math.abs(esperado)) : v === esperado;
  if (igual) ok++; else if (malos.length < 10) malos.push({ expr, esperado, obtenido: v });
}
console.log(`paridad Python/JS: ${ok} de ${casos.length} casos iguales`);
for (const m of malos) console.log(JSON.stringify(m).slice(0, 300));
process.exit(malos.length ? 1 : 0);
