const pool = require('../config/db');
const path = require('path');
const fs   = require('fs');
require('dotenv').config();

// LISTAR TODOS LOS PRODUCTOS ACTIVOS
async function listar(req, res) {
  try {
    const [productos] = await pool.query(
      `SELECT p.*, g.nombre_grupo 
       FROM productos p
       LEFT JOIN grupos_productos g ON p.grupo_id = g.id
       WHERE p.activo = 1
       ORDER BY p.created_at DESC`
    );
    res.json({ ok: true, productos });
  } catch (error) {
    console.error('Error listando productos:', error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// OBTENER UN PRODUCTO POR ID
async function obtener(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, g.nombre_grupo
       FROM productos p
       LEFT JOIN grupos_productos g ON p.grupo_id = g.id
       WHERE p.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Producto no encontrado' });
    }
    res.json({ ok: true, producto: rows[0] });
  } catch (error) {
    console.error('Error obteniendo producto:', error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// CREAR PRODUCTO
async function crear(req, res) {
  try {
    const {
      nombre, categoria, precio, precio_antes,
      oferta, tipo_oferta, fecha_fin, stock,
      nuevo, grupo_id
    } = req.body;

    if (!nombre || !categoria || !precio) {
      return res.status(400).json({ ok: false, mensaje: 'Nombre, categoría y precio son obligatorios' });
    }

    // IMAGEN — puede venir como archivo subido o como URL
    let imagen = null;
    if (req.file) {
      imagen = '/uploads/productos/' + req.file.filename;
    } else if (req.body.imagen_url) {
      // Si es base64, guardarla como texto largo
      // Si es URL normal, guardarla directamente
      imagen = req.body.imagen_url;
    }

    // SI TIENE grupo_id, verificar que existe
    let grupoIdFinal = null;
    if (grupo_id) {
      const [grupo] = await pool.query(
        'SELECT id FROM grupos_productos WHERE id = ?',
        [grupo_id]
      );
      if (grupo.length > 0) grupoIdFinal = grupo_id;
    }

    const [result] = await pool.query(
      `INSERT INTO productos 
       (nombre, categoria, precio, precio_antes, oferta, tipo_oferta, fecha_fin, stock, imagen, nuevo, grupo_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre, categoria,
        parseFloat(precio),
        precio_antes ? parseFloat(precio_antes) : null,
        oferta ? 1 : 0,
        tipo_oferta || null,
        fecha_fin || null,
        parseInt(stock) || 0,
        imagen,
        nuevo ? 1 : 0,
        grupoIdFinal
      ]
    );

    res.status(201).json({
      ok: true,
      mensaje: 'Producto creado correctamente',
      id: result.insertId
    });

  } catch (error) {
    console.error('Error creando producto:', error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ACTUALIZAR PRODUCTO
async function actualizar(req, res) {
  try {
    const {
      nombre, categoria, precio, precio_antes,
      oferta, tipo_oferta, fecha_fin, stock, nuevo
    } = req.body;

    if (!nombre || !precio) {
      return res.status(400).json({ ok: false, mensaje: 'Nombre y precio son obligatorios' });
    }

    // IMAGEN
    let imagenQuery = '';
    let imagenParams = [];
    if (req.file) {
      const nuevaImagen = '/uploads/productos/' + req.file.filename;
      imagenQuery = ', imagen = ?';
      imagenParams = [nuevaImagen];

      // Borrar imagen anterior si era un archivo local
      const [prod] = await pool.query('SELECT imagen FROM productos WHERE id = ?', [req.params.id]);
      if (prod.length > 0 && prod[0].imagen && prod[0].imagen.startsWith('/uploads/')) {
        const rutaVieja = path.join(__dirname, '../../', prod[0].imagen);
        if (fs.existsSync(rutaVieja)) fs.unlinkSync(rutaVieja);
      }
    } else if (req.body.imagen_url) {
      imagenQuery = ', imagen = ?';
      imagenParams = [req.body.imagen_url];
    }

    await pool.query(
      `UPDATE productos SET
        nombre = ?, categoria = ?, precio = ?, precio_antes = ?,
        oferta = ?, tipo_oferta = ?, fecha_fin = ?, stock = ?, nuevo = ?
        ${imagenQuery}
       WHERE id = ?`,
      [
        nombre, categoria,
        parseFloat(precio),
        precio_antes ? parseFloat(precio_antes) : null,
        oferta ? 1 : 0,
        tipo_oferta || null,
        fecha_fin || null,
        parseInt(stock) || 0,
        nuevo ? 1 : 0,
        ...imagenParams,
        req.params.id
      ]
    );

    res.json({ ok: true, mensaje: 'Producto actualizado correctamente' });

  } catch (error) {
    console.error('Error actualizando producto:', error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ELIMINAR PRODUCTO (soft delete)
async function eliminar(req, res) {
  try {
    await pool.query(
      'UPDATE productos SET activo = 0 WHERE id = ?',
      [req.params.id]
    );
    res.json({ ok: true, mensaje: 'Producto eliminado correctamente' });
  } catch (error) {
    console.error('Error eliminando producto:', error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// CREAR GRUPO DE VARIANTES
async function crearGrupo(req, res) {
  try {
    const { nombre_grupo, categoria } = req.body;
    if (!nombre_grupo || !categoria) {
      return res.status(400).json({ ok: false, mensaje: 'Nombre y categoría son obligatorios' });
    }
    const [result] = await pool.query(
      'INSERT INTO grupos_productos (nombre_grupo, categoria) VALUES (?, ?)',
      [nombre_grupo, categoria]
    );
    res.status(201).json({
      ok: true,
      mensaje: 'Grupo creado correctamente',
      id: result.insertId
    });
  } catch (error) {
    console.error('Error creando grupo:', error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// LISTAR GRUPOS CON SUS VARIANTES
async function listarGrupos(req, res) {
  try {
    const [grupos] = await pool.query('SELECT * FROM grupos_productos');
    for (let g of grupos) {
      const [variantes] = await pool.query(
        'SELECT * FROM productos WHERE grupo_id = ? AND activo = 1',
        [g.id]
      );
      g.variantes = variantes;
    }
    res.json({ ok: true, grupos });
  } catch (error) {
    console.error('Error listando grupos:', error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ACTUALIZAR STOCK
async function actualizarStock(req, res) {
  try {
    const { stock } = req.body;
    if (stock === undefined || stock < 0) {
      return res.status(400).json({ ok: false, mensaje: 'Stock inválido' });
    }
    await pool.query(
      'UPDATE productos SET stock = ? WHERE id = ?',
      [parseInt(stock), req.params.id]
    );
    res.json({ ok: true, mensaje: 'Stock actualizado correctamente' });
  } catch (error) {
    console.error('Error actualizando stock:', error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

module.exports = {
  listar, obtener, crear, actualizar,
  eliminar, crearGrupo, listarGrupos, actualizarStock
};