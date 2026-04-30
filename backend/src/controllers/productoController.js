const pool = require("../config/db");

const categoriasBase = [
  { nombre: "General", descripcion: "Categoría general" },
  { nombre: "Bebidas", descripcion: "Productos líquidos y bebidas" },
  { nombre: "Abarrotes", descripcion: "Productos de consumo general" },
  { nombre: "Servicios", descripcion: "Servicios y conceptos varios" },
];

const unidadesBase = [
  { codigo: "UNI", nombre: "Unidad" },
  { codigo: "CJ", nombre: "Caja" },
  { codigo: "LB", nombre: "Libra" },
  { codigo: "KG", nombre: "Kilogramo" },
];

const asegurarReferenciasBase = async (client) => {
  for (const categoria of categoriasBase) {
    await client.query(
      `
      INSERT INTO inventario.categoria (nombre, descripcion)
      VALUES ($1, $2)
      ON CONFLICT (nombre) DO NOTHING
      `,
      [categoria.nombre, categoria.descripcion]
    );
  }

  for (const unidad of unidadesBase) {
    await client.query(
      `
      INSERT INTO catalogo.unidad_medida (codigo, nombre)
      VALUES ($1, $2)
      ON CONFLICT (codigo) DO NOTHING
      `,
      [unidad.codigo, unidad.nombre]
    );
  }
};

const limpiarTexto = (valor) => String(valor || "").trim();
const normalizarCodigo = (valor) => limpiarTexto(valor).toUpperCase();

const esNumeroValido = (valor) => {
  const numero = Number(valor);
  return !Number.isNaN(numero) && Number.isFinite(numero);
};

const validarProducto = async (client, payload) => {
  const codigo = normalizarCodigo(payload.codigo);
  const nombre = limpiarTexto(payload.nombre);

  const {
    categoria_id,
    unidad_medida_id,
    precio_venta = 0,
    stock_minimo = 0,
  } = payload;

  if (!codigo) throw new Error("El código del producto es obligatorio.");

  if (codigo.length < 2 || codigo.length > 30) {
    throw new Error("El código debe tener entre 2 y 30 caracteres.");
  }

  if (!/^[A-Z0-9._-]+$/.test(codigo)) {
    throw new Error("El código solo puede contener letras, números, guion, punto o guion bajo.");
  }

  if (!nombre) throw new Error("El nombre del producto es obligatorio.");

  if (nombre.length < 2 || nombre.length > 150) {
    throw new Error("El nombre debe tener entre 2 y 150 caracteres.");
  }

  if (!categoria_id) throw new Error("Debe seleccionar una categoría.");
  if (!unidad_medida_id) throw new Error("Debe seleccionar una unidad de medida.");

  const numericos = [
    { campo: "precio de venta", valor: precio_venta, permiteCero: false },
    { campo: "stock mínimo", valor: stock_minimo, permiteCero: true },
  ];

  for (const item of numericos) {
    if (!esNumeroValido(item.valor)) throw new Error(`El ${item.campo} no es válido.`);

    const numero = Number(item.valor);
    if (numero < 0) throw new Error(`El ${item.campo} no puede ser negativo.`);
    if (!item.permiteCero && numero <= 0) throw new Error(`El ${item.campo} debe ser mayor que cero.`);
  }

  const categoriaRes = await client.query(
    `SELECT id FROM inventario.categoria WHERE id = $1 LIMIT 1`,
    [Number(categoria_id)]
  );

  if (categoriaRes.rowCount === 0) throw new Error("La categoría seleccionada no existe.");

  const unidadRes = await client.query(
    `SELECT id FROM catalogo.unidad_medida WHERE id = $1 LIMIT 1`,
    [Number(unidad_medida_id)]
  );

  if (unidadRes.rowCount === 0) throw new Error("La unidad de medida seleccionada no existe.");
};

const obtenerReferenciasProducto = async (req, res) => {
  const client = await pool.connect();

  try {
    await asegurarReferenciasBase(client);

    const [categorias, unidades] = await Promise.all([
      client.query(`
        SELECT id, nombre, descripcion
        FROM inventario.categoria
        ORDER BY nombre ASC
      `),
      client.query(`
        SELECT id, codigo, nombre
        FROM catalogo.unidad_medida
        ORDER BY nombre ASC
      `),
    ]);

    res.json({
      ok: true,
      mensaje: "Referencias de producto obtenidas correctamente",
      data: { categorias: categorias.rows, unidades: unidades.rows },
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      mensaje: "Error al obtener referencias de producto",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const obtenerProductos = async (req, res) => {
  const client = await pool.connect();

  try {
    await asegurarReferenciasBase(client);

    const result = await client.query(`
      SELECT
        p.id,
        p.codigo,
        p.nombre,
        p.descripcion,
        p.categoria_id,
        c.nombre AS categoria_nombre,
        p.unidad_medida_id,
        um.codigo AS unidad_codigo,
        um.nombre AS unidad_nombre,
        p.precio_venta,
        p.stock_minimo,
        p.aplica_iva,
        p.activo,
        p.fecha_creacion,
        COALESCE(SUM(e.cantidad), 0) AS stock_actual
      FROM inventario.producto p
      LEFT JOIN inventario.categoria c ON c.id = p.categoria_id
      LEFT JOIN catalogo.unidad_medida um ON um.id = p.unidad_medida_id
      LEFT JOIN inventario.existencia e ON e.producto_id = p.id
      GROUP BY p.id, c.nombre, um.codigo, um.nombre
      ORDER BY p.id ASC
    `);

    res.json({
      ok: true,
      mensaje: "Lista de productos obtenida correctamente",
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      mensaje: "Error al obtener los productos",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const crearProducto = async (req, res) => {
  const client = await pool.connect();

  try {
    await asegurarReferenciasBase(client);
    await validarProducto(client, req.body);

    const {
      codigo,
      nombre,
      descripcion,
      categoria_id,
      unidad_medida_id,
      precio_venta,
      stock_minimo = 0,
      aplica_iva = true,
      activo = true,
    } = req.body;

    const result = await client.query(
      `
      INSERT INTO inventario.producto
      (
        codigo,
        nombre,
        descripcion,
        categoria_id,
        unidad_medida_id,
        precio_venta,
        costo_referencia,
        costo_promedio,
        stock_minimo,
        aplica_iva,
        activo
      )
      VALUES ($1,$2,$3,$4,$5,$6,0,0,$7,$8,$9)
      RETURNING *
      `,
      [
        normalizarCodigo(codigo),
        limpiarTexto(nombre),
        limpiarTexto(descripcion) || null,
        Number(categoria_id),
        Number(unidad_medida_id),
        Number(precio_venta),
        Number(stock_minimo),
        Boolean(aplica_iva),
        Boolean(activo),
      ]
    );

    res.json({ ok: true, mensaje: "Producto creado correctamente", data: result.rows[0] });
  } catch (error) {
    res.status(400).json({
      ok: false,
      mensaje: error.code === "23505" ? "Ya existe un producto con ese código." : error.message,
    });
  } finally {
    client.release();
  }
};

const actualizarProducto = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    await asegurarReferenciasBase(client);
    await validarProducto(client, req.body);

    const {
      codigo,
      nombre,
      descripcion,
      categoria_id,
      unidad_medida_id,
      precio_venta,
      stock_minimo = 0,
      aplica_iva = true,
      activo = true,
    } = req.body;

    const result = await client.query(
      `
      UPDATE inventario.producto
      SET
        codigo = $1,
        nombre = $2,
        descripcion = $3,
        categoria_id = $4,
        unidad_medida_id = $5,
        precio_venta = $6,
        costo_referencia = 0,
        costo_promedio = 0,
        stock_minimo = $7,
        aplica_iva = $8,
        activo = $9
      WHERE id = $10
      RETURNING *
      `,
      [
        normalizarCodigo(codigo),
        limpiarTexto(nombre),
        limpiarTexto(descripcion) || null,
        Number(categoria_id),
        Number(unidad_medida_id),
        Number(precio_venta),
        Number(stock_minimo),
        Boolean(aplica_iva),
        Boolean(activo),
        Number(id),
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, mensaje: "Producto no encontrado." });
    }

    res.json({ ok: true, mensaje: "Producto actualizado correctamente", data: result.rows[0] });
  } catch (error) {
    res.status(400).json({
      ok: false,
      mensaje: error.code === "23505" ? "Ya existe otro producto con ese código." : error.message,
    });
  } finally {
    client.release();
  }
};

const eliminarProducto = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const productoId = Number(id);

    if (!Number.isFinite(productoId)) {
      return res.status(400).json({ ok: false, mensaje: "ID de producto inválido." });
    }

    await client.query("BEGIN");

    const producto = await client.query(
      `SELECT id, nombre FROM inventario.producto WHERE id = $1 LIMIT 1`,
      [productoId]
    );

    if (producto.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, mensaje: "Producto no encontrado." });
    }

    const ventas = await client.query(
      `SELECT COUNT(*)::int AS total FROM ventas.venta_detalle WHERE producto_id = $1`,
      [productoId]
    );

    if (Number(ventas.rows[0].total) > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        ok: false,
        mensaje:
          "No se puede eliminar de la base de datos porque este producto ya está usado en ventas. Puedes dejarlo inactivo editándolo.",
      });
    }

    await client.query(
      `DELETE FROM inventario.movimiento WHERE producto_id = $1`,
      [productoId]
    );

    await client.query(
      `DELETE FROM inventario.existencia WHERE producto_id = $1`,
      [productoId]
    );

    const result = await client.query(
      `DELETE FROM inventario.producto WHERE id = $1 RETURNING *`,
      [productoId]
    );

    await client.query("COMMIT");

    res.json({
      ok: true,
      mensaje: "Producto eliminado correctamente de la base de datos.",
      data: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(500).json({
      ok: false,
      mensaje: "Error al eliminar producto.",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

module.exports = {
  obtenerReferenciasProducto,
  obtenerProductos,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
};
