(() => {
  const C = window.CATALOGO;
  const CFG = window.MANIVA_CONFIG;
  const $ = (s) => document.querySelector(s);
  const fmt = (n) => '$' + Math.round(n).toLocaleString('es-AR');
  const porSku = Object.fromEntries(C.productos.map((p) => [p.sku, p]));
  const porKit = Object.fromEntries(C.kits.map((k) => [k.id, k]));
  const CLAVE = 'maniva-pedido';

  let carrito = {};
  let pago = 'efectivo';
  let filtro = 'todos';
  try { carrito = JSON.parse(localStorage.getItem(CLAVE) || '{}'); } catch (e) { carrito = {}; }
  const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(carrito)); } catch (e) {} };

  // ---------- precios ----------
  // Nivel por cantidad: solo productos sin "sinNivel" (esmaltes, bases, tops, builder), pago en efectivo/transferencia.
  function nivelActual() {
    let unidades = 0, monto = 0;
    for (const [id, q] of Object.entries(carrito)) {
      const p = porSku[id];
      if (p && !p.sinNivel) { unidades += q; monto += q * p.efectivo; }
    }
    let nivel = 0;
    if (pago === 'efectivo') C.niveles.forEach((n, i) => { if (unidades >= n.unidades || monto >= n.monto) nivel = i + 1; });
    return { nivel, unidades, monto };
  }
  function precioProducto(p, nivel) {
    let precio = pago === 'tarjeta' ? p.tarjeta
      : nivel === 2 && p.n2 ? p.n2
      : nivel === 1 && p.n1 ? p.n1
      : p.efectivo;
    return Math.max(precio, Math.ceil(p.minimo)); // nunca debajo del mínimo de Pink Mask
  }
  function precioKit(k) { return Math.max(pago === 'tarjeta' ? k.tarjeta : k.efectivo, Math.ceil(k.minimo)); }

  // ---------- catálogo ----------
  function tarjetaProducto(p) {
    const precio = pago === 'tarjeta' ? p.tarjeta : p.efectivo;
    const escala = pago === 'efectivo' && !p.sinNivel && p.n1
      ? `<p class="escala">Desde ${C.niveles[0].unidades} u.: <b>${fmt(p.n1)}</b> · desde ${C.niveles[1].unidades} u.: <b>${fmt(p.n2)}</b></p>` : '';
    return `<article class="card" data-cat="${p.cat}">
      <img src="img/p/${p.sku}.jpg" alt="${p.nombre} Pink Mask" loading="lazy">
      <div class="info">
        <h3>${p.nombre}</h3>
        <p class="tono">${p.tono}</p>
        <p class="precio">${fmt(precio)}</p>
        ${escala}
        <button class="agregar" data-id="${p.sku}">Agregar</button>
      </div>
    </article>`;
  }
  function tarjetaKit(k) {
    const fotos = k.incluye.slice(0, 4).map((s) => `<img src="img/p/${s}.jpg" alt="" loading="lazy">`).join('');
    const separado = k.incluye.reduce((t, s) => t + (pago === 'tarjeta' ? porSku[s].tarjeta : porSku[s].efectivo), 0);
    const precio = precioKit(k);
    return `<article class="card kit">
      <div class="mosaico n${Math.min(k.incluye.length, 4)}">${fotos}</div>
      <div class="info">
        <h3>${k.nombre}</h3>
        <p class="tono">${k.detalle}</p>
        <p class="precio">${fmt(precio)} ${separado > precio ? `<s>${fmt(separado)}</s>` : ''}</p>
        <button class="agregar" data-id="${k.id}">Agregar</button>
      </div>
    </article>`;
  }
  function pintarCatalogo() {
    const lista = C.productos.filter((p) => filtro === 'todos' || p.cat === filtro);
    $('#grilla').innerHTML = lista.map(tarjetaProducto).join('');
    $('#grillaKits').innerHTML = C.kits.map(tarjetaKit).join('');
  }

  // ---------- carrito ----------
  function pintarCarrito() {
    const { nivel, unidades, monto } = nivelActual();
    const entradas = Object.entries(carrito).filter(([, q]) => q > 0);
    $('#contador').textContent = entradas.reduce((t, [, q]) => t + q, 0);
    if (!entradas.length) {
      $('#items').innerHTML = '<p class="vacio">Todavía no agregaste productos.</p>';
      $('#totales').innerHTML = ''; $('#aviso').innerHTML = '';
      return;
    }
    let total = 0, base = 0;
    $('#items').innerHTML = entradas.map(([id, q]) => {
      const p = porSku[id], k = porKit[id];
      const nombre = p ? p.nombre : k.nombre;
      const unit = p ? precioProducto(p, nivel) : precioKit(k);
      const unitBase = p ? (pago === 'tarjeta' ? p.tarjeta : p.efectivo) : precioKit(k);
      total += unit * q; base += unitBase * q;
      return `<div class="item">
        <img src="img/p/${p ? p.sku : k.incluye[0]}.jpg" alt="">
        <div class="det"><b>${nombre}</b><span>${fmt(unit)} c/u</span></div>
        <div class="qty">
          <button data-menos="${id}" aria-label="Quitar uno">−</button><span>${q}</span><button data-mas="${id}" aria-label="Agregar uno">+</button>
        </div>
        <b class="sub">${fmt(unit * q)}</b>
      </div>`;
    }).join('');
    const ahorro = base - total;
    $('#totales').innerHTML = `
      ${nivel ? `<div class="fila"><span>Descuento por cantidad (${C.niveles[nivel - 1].nombre})</span><span>−${fmt(ahorro)}</span></div>` : ''}
      <div class="fila total"><span>Total ${pago === 'tarjeta' ? 'con tarjeta' : 'en efectivo o transferencia'}</span><span>${fmt(total)}</span></div>
      <p class="chico">Envío no incluido.</p>`;
    // aviso para subir de nivel
    let aviso = '';
    if (pago === 'efectivo' && nivel < C.niveles.length && unidades > 0) {
      const n = C.niveles[nivel];
      const faltanU = n.unidades - unidades, faltanM = n.monto - monto;
      aviso = `Sumá ${faltanU} ${faltanU === 1 ? 'unidad' : 'unidades'} más (o ${fmt(faltanM)} en esmaltes, bases, tops o Builder) y accedés al precio por cantidad.`;
    } else if (pago === 'tarjeta' && unidades >= C.niveles[0].unidades) {
      aviso = 'Pagando en efectivo o transferencia, este pedido tiene descuento por cantidad.';
    }
    $('#aviso').innerHTML = aviso ? `<p>${aviso}</p>` : '';
  }
  function sumar(id, d) {
    carrito[id] = Math.max(0, (carrito[id] || 0) + d);
    if (!carrito[id]) delete carrito[id];
    guardar(); pintarCarrito();
  }

  function mensajeWhatsapp() {
    const { nivel } = nivelActual();
    let total = 0;
    const lineas = Object.entries(carrito).map(([id, q]) => {
      const p = porSku[id], k = porKit[id];
      const unit = p ? precioProducto(p, nivel) : precioKit(k);
      total += unit * q;
      return `• ${q} x ${p ? p.nombre : k.nombre} (${id}): ${fmt(unit)} c/u = ${fmt(unit * q)}`;
    });
    const nombre = $('#nombre').value.trim(), loc = $('#localidad').value.trim();
    return [
      'Hola maniva! Quiero hacer este pedido:', '', ...lineas, '',
      `Forma de pago: ${pago === 'tarjeta' ? 'tarjeta' : 'efectivo o transferencia'}`,
      nivel ? `Descuento por cantidad: ${C.niveles[nivel - 1].nombre}` : '',
      `Total: ${fmt(total)} (sin envío)`,
      nombre ? `Nombre: ${nombre}` : '', loc ? `Localidad: ${loc}` : '',
    ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
  }
  const linkWa = (txt) => `https://wa.me/${CFG.whatsapp || ''}?text=${encodeURIComponent(txt)}`;

  // ---------- eventos ----------
  const abrir = () => { $('#carrito').classList.add('abierto'); $('#velo').classList.add('abierto'); $('#carrito').setAttribute('aria-hidden', 'false'); };
  const cerrar = () => { $('#carrito').classList.remove('abierto'); $('#velo').classList.remove('abierto'); $('#carrito').setAttribute('aria-hidden', 'true'); };
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (t.matches('.agregar')) {
      sumar(t.dataset.id, 1);
      t.textContent = 'Agregado ✓'; setTimeout(() => (t.textContent = 'Agregar'), 1200);
    }
    if (t.dataset.mas) sumar(t.dataset.mas, 1);
    if (t.dataset.menos) sumar(t.dataset.menos, -1);
    if (t.matches('#filtros button')) {
      filtro = t.dataset.cat;
      document.querySelectorAll('#filtros button').forEach((b) => b.classList.toggle('activo', b === t));
      pintarCatalogo();
    }
  });
  document.querySelectorAll('input[name=pago]').forEach((r) => r.addEventListener('change', () => { pago = r.value; pintarCatalogo(); pintarCarrito(); }));
  $('#abrirCarrito').addEventListener('click', abrir);
  $('#cerrarCarrito').addEventListener('click', cerrar);
  $('#velo').addEventListener('click', cerrar);
  $('#enviar').addEventListener('click', () => {
    if (!Object.keys(carrito).length) return;
    window.open(linkWa(mensajeWhatsapp()), '_blank', 'noopener');
  });

  // ---------- contenido fijo ----------
  $('#vigencia').textContent = C.vigencia.toLowerCase();
  $('#envios').innerHTML = CFG.envios.map((e) => `<li>${e}</li>`).join('');
  $('#pieWhatsapp').href = linkWa('Hola maniva! Quería hacer una consulta.');
  $('#pieInstagram').href = CFG.instagram;
  const gel = porSku['GELCOL-136'];
  $('#niveles').innerHTML = `
    <div><span>1 a ${C.niveles[0].unidades - 1} unidades</span><b>${fmt(gel.efectivo)}</b><small>por esmalte</small></div>
    <div><span>Desde ${C.niveles[0].unidades} u. o ${fmt(C.niveles[0].monto)}</span><b>${fmt(gel.n1)}</b><small>por esmalte</small></div>
    <div><span>Desde ${C.niveles[1].unidades} u. o ${fmt(C.niveles[1].monto)}</span><b>${fmt(gel.n2)}</b><small>por esmalte</small></div>`;

  pintarCatalogo();
  pintarCarrito();
})();
