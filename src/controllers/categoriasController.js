const pool = require('../config/db');

// Convierte "Pan y Pastelería" -> "pan-y-pasteleria"
function generarSlug(texto) {
  return texto
    .toString()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// LISTAR TODAS LAS CATEGORÍAS (público)
async function listar(req, res) {
  try {
    const [categorias] = await pool.query(
      'SELECT * FROM categorias ORDER BY orden ASC, nombre_visible ASC'
    );
    res.json({ ok: true, categorias });
  } catch (error) {
    console.error('Error listando categorías:', error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// CREAR CATEGORÍA (admin)
async function crear(req, res) {
  try {
    const { nombre_visible } = req.body;
    if (!nombre_visible || !nombre_visible.trim()) {
      return res.status(400).json({ ok: false, mensaje: 'El nombre de la categoría es obligatorio' });
    }

    const slug = generarSlug(nombre_visible);
    if (!slug) {
      return res.status(400).json({ ok: false, mensaje: 'Nombre de categoría inválido' });
    }

    const [existente] = await pool.query('SELECT id FROM categorias WHERE slug = ?', [slug]);
    if (existente.length > 0) {
      return res.status(409).json({ ok: false, mensaje: 'Ya existe una categoría con ese nombre' });
    }

    const [result] = await pool.query(
      'INSERT INTO categorias (slug, nombre_visible) VALUES (?, ?)',
      [slug, nombre_visible.trim()]
    );

    res.status(201).json({
      ok: true,
      mensaje: 'Categoría creada correctamente',
      categoria: { id: result.insertId, slug, nombre_visible: nombre_visible.trim() }
    });
  } catch (error) {
    console.error('Error creando categoría:', error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ACTUALIZAR NOMBRE VISIBLE (admin) — el slug NO cambia para no romper productos existentes
async function actualizar(req, res) {
  try {
    const { nombre_visible } = req.body;
    if (!nombre_visible || !nombre_visible.trim()) {
      return res.status(400).json({ ok: false, mensaje: 'El nombre de la categoría es obligatorio' });
    }

    await pool.query(
      'UPDATE categorias SET nombre_visible = ? WHERE id = ?',
      [nombre_visible.trim(), req.params.id]
    );

    res.json({ ok: true, mensaje: 'Categoría actualizada correctamente' });
  } catch (error) {
    console.error('Error actualizando categoría:', error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ELIMINAR CATEGORÍA (admin) — bloqueada si hay productos activos usándola
async function eliminar(req, res) {
  try {
    const [cat] = await pool.query('SELECT slug FROM categorias WHERE id = ?', [req.params.id]);
    if (cat.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Categoría no encontrada' });
    }

    const [enUso] = await pool.query(
      'SELECT COUNT(*) AS total FROM productos WHERE categoria = ? AND activo = 1',
      [cat[0].slug]
    );

    if (enUso[0].total > 0) {
      return res.status(409).json({
        ok: false,
        mensaje: `No se puede eliminar: ${enUso[0].total} producto(s) usan esta categoría. Reasígnalos primero.`
      });
    }

    await pool.query('DELETE FROM categorias WHERE id = ?', [req.params.id]);
    res.json({ ok: true, mensaje: 'Categoría eliminada correctamente' });
  } catch (error) {
    console.error('Error eliminando categoría:', error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

module.exports = { listar, crear, actualizar, eliminar };