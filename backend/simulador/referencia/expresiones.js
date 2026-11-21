// Evaluador de las expresiones del paquete para JavaScript (navegador o Node). Misma semántica que expresiones.py.
// Uso: const ev = Expresiones.crear({ parametros, tablas, azar });  ev.evaluar("k('P_DESPIDO', banda3)", estado)
//   parametros: { ID: valor } ; tablas: { nombre: [ {col: texto, ...}, ... ] } ; azar: función que devuelve [0, 1)
(function (raiz) {
  const FUNCIONES = new Set(['si', 'y', 'o', 'no', 'en', 'min', 'max', 'clamp', 'exp', 'ln', 'pow', 'abs', 'redondear', 'k', 'tabla', 'tabla_o', 'q_muerte', 'luto',
    'falso', 'azar', 'azar_uniforme', 'azar_normal', 'azar_lognormal', 'azar_entero']);

  // --- parser de descenso recursivo
  function lexer(src) {
    const t = []; let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (/[0-9.]/.test(c)) { let j = i; while (j < src.length && /[0-9.eE]/.test(src[j])) j++; t.push({ t: 'num', v: parseFloat(src.slice(i, j)) }); i = j; continue; }
      if (c === "'") { let j = i + 1; while (src[j] !== "'") { if (j >= src.length) throw new Error('texto sin cerrar'); j++; } t.push({ t: 'str', v: src.slice(i + 1, j) }); i = j + 1; continue; }
      if (/[A-Za-z_ÁÉÍÓÚáéíóúñÑ]/.test(c)) { let j = i; while (j < src.length && /[A-Za-z0-9_ÁÉÍÓÚáéíóúñÑ]/.test(src[j])) j++; t.push({ t: 'id', v: src.slice(i, j) }); i = j; continue; }
      const dos = src.slice(i, i + 2);
      if (['<=', '>=', '==', '!='].includes(dos)) { t.push({ t: 'op', v: dos }); i += 2; continue; }
      if ('+-*/%<>(),'.includes(c)) { t.push({ t: 'op', v: c }); i++; continue; }
      throw new Error('carácter no permitido: ' + c);
    }
    return t;
  }
  function parsear(src) {
    const t = lexer(String(src)); let p = 0;
    const ver = (v) => t[p] && t[p].t === 'op' && t[p].v === v;
    const tomar = (v) => { if (!ver(v)) throw new Error('se esperaba ' + v); p++; };
    function comparacion() { let a = suma(); if (t[p] && t[p].t === 'op' && ['<', '<=', '>', '>=', '==', '!='].includes(t[p].v)) { const op = t[p++].v; a = { k: 'cmp', op, a, b: suma() }; } return a; }
    function suma() { let a = prod(); while (ver('+') || ver('-')) { const op = t[p++].v; a = { k: 'bin', op, a, b: prod() }; } return a; }
    function prod() { let a = unario(); while (ver('*') || ver('/') || ver('%')) { const op = t[p++].v; a = { k: 'bin', op, a, b: unario() }; } return a; }
    function unario() { if (ver('-')) { p++; return { k: 'neg', a: unario() }; } if (ver('+')) { p++; return unario(); } return atomo(); }
    function atomo() {
      const x = t[p++]; if (!x) throw new Error('expresión incompleta');
      if (x.t === 'num' || x.t === 'str') return { k: 'lit', v: x.v };
      if (x.t === 'op' && x.v === '(') { const a = comparacion(); tomar(')'); return a; }
      if (x.t === 'id') {
        if (ver('(')) {
          if (!FUNCIONES.has(x.v)) throw new Error('función no permitida: ' + x.v);
          p++; const args = []; if (!ver(')')) { args.push(comparacion()); while (ver(',')) { p++; args.push(comparacion()); } } tomar(')');
          return { k: 'call', f: x.v, args };
        }
        return { k: 'var', n: x.v };
      }
      throw new Error('token inesperado');
    }
    const arbol = comparacion(); if (p !== t.length) throw new Error('sobra texto en la expresión'); return arbol;
  }

  const clave = (v) => (typeof v === 'number' && Number.isInteger(v) ? String(v) : String(v));
  const verdad = (v) => (typeof v === 'string' ? v !== '' : !!v);

  function crear({ parametros, tablas, azar }) {
    const arboles = new Map(), cache = new Map(), rnd = azar || Math.random;
    function tabla(nombre, col, ...pares) {
      const ck = [nombre, col, ...pares.map(clave)].join('|'); if (cache.has(ck)) return cache.get(ck);
      const filas = tablas[nombre]; if (!filas) throw new Error('tabla desconocida: ' + nombre);
      for (const f of filas) {
        let ok = true; for (let i = 0; i < pares.length; i += 2) if (clave(f[pares[i]]) !== clave(pares[i + 1])) { ok = false; break; }
        if (!ok) continue;
        const txt = f[col]; if (txt === '' || txt == null) throw new Error('celda vacía: ' + nombre + '.' + col);
        const v = isNaN(+txt) ? txt : +txt; cache.set(ck, v); return v;
      }
      throw new Error('sin fila: ' + nombre + ' ' + pares.join(','));
    }
    function k(nombre, c, defecto) {
      if (!(nombre in parametros)) throw new Error('parámetro desconocido: ' + nombre);
      const v = parametros[nombre]; if (c === undefined) return v;
      if (Array.isArray(v)) return v[c | 0];
      if (clave(c) in v) return v[clave(c)]; if (defecto !== undefined) return defecto;
      throw new Error('clave ' + c + ' no está en ' + nombre);
    }
    const normal = () => { let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    function luto(quien, anos, e) {
      const per = anos <= 0 ? 'ano_0' : anos === 1 ? 'ano_1' : anos <= 3 ? 'anos_2_3' : anos <= 5 ? 'anos_4_5' : null; if (!per) return 0;
      const g = (c) => tabla('duelo_satisfaccion', c, 'fallece', quien, 'periodo', per);
      return Math.min(0, g('base_hija_46') + g('por_ano_de_edad') * (e.edad - 46) + g('si_es_hijo_hombre') * (e.sexo === 'h' ? 1 : 0));
    }
    function ev(n, e) {
      switch (n.k) {
        case 'lit': return n.v;
        case 'var': if (!(n.n in e)) throw new Error('variable sin valor: ' + n.n); return e[n.n];
        case 'neg': return -ev(n.a, e);
        case 'bin': { const a = ev(n.a, e), b = ev(n.b, e); return n.op === '+' ? a + b : n.op === '-' ? a - b : n.op === '*' ? a * b : n.op === '/' ? a / b : a % b; }
        case 'cmp': { const a = ev(n.a, e), b = ev(n.b, e); const r = n.op === '<' ? a < b : n.op === '<=' ? a <= b : n.op === '>' ? a > b : n.op === '>=' ? a >= b : n.op === '==' ? a === b : a !== b; return r ? 1 : 0; }
      }
      const A = n.args, x = (i) => ev(A[i], e);
      if (n.f === 'si') return verdad(x(0)) ? x(1) : x(2);
      if (n.f === 'y') return A.every((a) => verdad(ev(a, e))) ? 1 : 0;
      if (n.f === 'o') return A.some((a) => verdad(ev(a, e))) ? 1 : 0;
      if (n.f === 'no') return verdad(x(0)) ? 0 : 1;
      const a = A.map((q) => ev(q, e));
      switch (n.f) {
        case 'en': return a.slice(1).includes(a[0]) ? 1 : 0;
        case 'min': return Math.min(...a); case 'max': return Math.max(...a);
        case 'clamp': return Math.max(a[1], Math.min(a[2], a[0]));
        case 'exp': return Math.exp(a[0]); case 'ln': return Math.log(a[0]); case 'pow': return Math.pow(a[0], a[1]);
        case 'abs': return Math.abs(a[0]); case 'redondear': return Math.round(a[0]);
        case 'k': return k(...a); case 'tabla': return tabla(...a);
        case 'tabla_o': try { return tabla(...a.slice(1)); } catch (err) { return a[0]; }
        case 'q_muerte': { const [ga, gb] = k('MORT_GOMPERTZ', a[1]); return Math.min(0.6, Math.exp(ga + gb * a[0])); }
        case 'luto': return luto(a[0], a[1], e);
        case 'falso': return 0; case 'azar': return rnd();
        case 'azar_uniforme': return a[0] + (a[1] - a[0]) * rnd();
        case 'azar_normal': return normal();
        case 'azar_entero': return a[0] + Math.floor(rnd() * (a[1] - a[0] + 1));
        case 'azar_lognormal': { const s = (Math.log(a[2]) - Math.log(a[0])) / (2 * 1.2816); return Math.exp(Math.log(a[1]) + s * normal()); }
      }
      throw new Error('función sin implementar: ' + n.f);
    }
    return {
      evaluar(expr, estado) {
        if (typeof expr === 'number') return expr;
        if (!arboles.has(expr)) arboles.set(expr, parsear(expr));
        return ev(arboles.get(expr), estado);
      },
      parsear, tabla, k,
    };
  }
  const api = { crear, parsear };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else raiz.Expresiones = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
