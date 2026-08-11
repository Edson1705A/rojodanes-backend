const pool = require('../config/db');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// LISTAR TODOS LOS USUARIOS (solo admin)
async function listar(req, res) {
  try {
    const [usuarios] = await pool.query(
      `SELECT id, id_publico, nombre, username, correo, 
              telefono, dni, bloqueado, fecha_registro, created_at
       FROM usuarios
       ORDER BY created_at DESC`
    );
    res.json({ ok: true, usuarios });
  } catch (error) {
    console.error('Error listando usuarios:', error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// OBTENER UN USUARIO POR ID (solo admin)
async function obtener(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT id, id_publico, nombre, username, correo,
              telefono, dni, bloqueado, fecha_registro
       FROM usuarios WHERE id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' });
    }
    res.json({ ok: true, usuario: rows[0] });
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// BLOQUEAR / DESBLOQUEAR USUARIO (solo admin)
async function toggleBloquear(req, res) {
  try {
    const [rows] = await pool.query(
      'SELECT id, bloqueado, nombre FROM usuarios WHERE id = ?',
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' });
    }

    const usuario     = rows[0];
    const nuevoBloq   = usuario.bloqueado ? 0 : 1;
    const accion      = nuevoBloq ? 'bloqueado' : 'desbloqueado';

    await pool.query(
      'UPDATE usuarios SET bloqueado = ? WHERE id = ?',
      [nuevoBloq, req.params.id]
    );

    res.json({
      ok: true,
      mensaje: 'Usuario ' + accion + ' correctamente',
      bloqueado: nuevoBloq === 1
    });

  } catch (error) {
    console.error('Error bloqueando usuario:', error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ESTADÍSTICAS GENERALES (solo admin — para el perfil admin)
async function estadisticas(req, res) {
  try {
    const [[{ totalUsuarios }]] = await pool.query(
      'SELECT COUNT(*) as totalUsuarios FROM usuarios'
    );
    const [[{ totalProductos }]] = await pool.query(
      'SELECT COUNT(*) as totalProductos FROM productos WHERE activo = 1'
    );
    const [[{ totalPedidos }]] = await pool.query(
      'SELECT COUNT(*) as totalPedidos FROM pedidos'
    );
    const [[{ pedidosProcesando }]] = await pool.query(
      "SELECT COUNT(*) as pedidosProcesando FROM pedidos WHERE estado = 'procesando'"
    );

    res.json({
      ok: true,
      estadisticas: {
        totalUsuarios,
        totalProductos,
        totalPedidos,
        pedidosProcesando
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

module.exports = { listar, obtener, toggleBloquear, estadisticas };