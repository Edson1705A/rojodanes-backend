const pool = require('../config/db');
require('dotenv').config();

// CREAR PEDIDO
async function crear(req, res) {
  try {
    const { items, metodo_pago, nota } = req.body;
    const usuario_id = req.usuario.id;

    if (!items || items.length === 0) {
      return res.status(400).json({ ok: false, mensaje: 'El pedido no tiene productos' });
    }
    if (!metodo_pago) {
      return res.status(400).json({ ok: false, mensaje: 'Selecciona un método de pago' });
    }

    // CALCULAR TOTAL Y VERIFICAR STOCK
    let total = 0;
    for (let item of items) {
      const [rows] = await pool.query(
        'SELECT id, nombre, precio, stock FROM productos WHERE id = ? AND activo = 1',
        [item.producto_id]
      );
      if (rows.length === 0) {
        return res.status(400).json({ ok: false, mensaje: 'Producto no encontrado: ' + item.producto_id });
      }
      const producto = rows[0];
      if (producto.stock < item.cantidad) {
        return res.status(400).json({
          ok: false,
          mensaje: 'Stock insuficiente para: ' + producto.nombre
        });
      }
      item._nombre = producto.nombre;
      item._precio = producto.precio;
      total += producto.precio * item.cantidad;
    }

    // CREAR PEDIDO
    const [pedidoResult] = await pool.query(
      `INSERT INTO pedidos (usuario_id, total, metodo_pago, nota, estado)
       VALUES (?, ?, ?, ?, 'procesando')`,
      [usuario_id, total.toFixed(2), metodo_pago, nota || null]
    );
    const pedidoId = pedidoResult.insertId;

    // INSERTAR ITEMS Y DESCONTAR STOCK
    for (let item of items) {
      await pool.query(
        `INSERT INTO pedido_items (pedido_id, producto_id, nombre_producto, cantidad, precio_unitario)
         VALUES (?, ?, ?, ?, ?)`,
        [pedidoId, item.producto_id, item._nombre, item.cantidad, item._precio]
      );

      await pool.query(
        'UPDATE productos SET stock = stock - ? WHERE id = ?',
        [item.cantidad, item.producto_id]
      );
    }

    res.status(201).json({
      ok: true,
      mensaje: 'Pedido creado correctamente',
      pedido_id: pedidoId,
      total: total.toFixed(2)
    });

  } catch (error) {
    console.error('Error creando pedido:', error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// LISTAR PEDIDOS DEL USUARIO LOGUEADO
async function listarMisPedidos(req, res) {
  try {
    const [pedidos] = await pool.query(
      `SELECT p.*, 
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'id', pi.id,
            'producto_id', pi.producto_id,
            'nombre', pi.nombre_producto,
            'cantidad', pi.cantidad,
            'precio_unitario', pi.precio_unitario
          )
        ) as items
       FROM pedidos p
       LEFT JOIN pedido_items pi ON p.id = pi.pedido_id
       WHERE p.usuario_id = ?
       GROUP BY p.id
       ORDER BY p.fecha DESC`,
      [req.usuario.id]
    );

    // Parsear items si viene como string
    pedidos.forEach(function(p) {
      if (typeof p.items === 'string') p.items = JSON.parse(p.items);
    });

    res.json({ ok: true, pedidos });

  } catch (error) {
    console.error('Error listando pedidos:', error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// CANCELAR PEDIDO (solo el dueño, solo si está en procesando)
async function cancelar(req, res) {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM pedidos WHERE id = ? AND usuario_id = ?',
      [req.params.id, req.usuario.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Pedido no encontrado' });
    }

    const pedido = rows[0];

    if (pedido.estado !== 'procesando') {
      return res.status(400).json({
        ok: false,
        mensaje: 'Solo puedes cancelar pedidos en estado Procesando'
      });
    }

    // CAMBIAR ESTADO
    await pool.query(
      "UPDATE pedidos SET estado = 'cancelado' WHERE id = ?",
      [req.params.id]
    );

    // DEVOLVER STOCK
    const [items] = await pool.query(
      'SELECT * FROM pedido_items WHERE pedido_id = ?',
      [req.params.id]
    );
    for (let item of items) {
      await pool.query(
        'UPDATE productos SET stock = stock + ? WHERE id = ?',
        [item.cantidad, item.producto_id]
      );
    }

    res.json({ ok: true, mensaje: 'Pedido cancelado correctamente' });

  } catch (error) {
    console.error('Error cancelando pedido:', error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// LISTAR TODOS LOS PEDIDOS (solo admin)
async function listarTodos(req, res) {
  try {
    const { estado } = req.query;

    let query =
      `SELECT p.*,
        u.nombre as nombre_usuario,
        u.correo as correo_usuario,
        u.telefono as telefono_usuario,
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'id', pi.id,
            'producto_id', pi.producto_id,
            'nombre', pi.nombre_producto,
            'cantidad', pi.cantidad,
            'precio_unitario', pi.precio_unitario
          )
        ) as items
       FROM pedidos p
       LEFT JOIN usuarios u ON p.usuario_id = u.id
       LEFT JOIN pedido_items pi ON p.id = pi.pedido_id`;

    const params = [];
    if (estado && estado !== 'todos') {
      query += ' WHERE p.estado = ?';
      params.push(estado);
    }

    query += ' GROUP BY p.id ORDER BY p.fecha DESC';

    const [pedidos] = await pool.query(query, params);

    pedidos.forEach(function(p) {
      if (typeof p.items === 'string') p.items = JSON.parse(p.items);
    });

    res.json({ ok: true, pedidos });

  } catch (error) {
    console.error('Error listando todos los pedidos:', error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// CAMBIAR ESTADO DE PEDIDO (solo admin)
async function cambiarEstado(req, res) {
  try {
    const { estado } = req.body;
    const estadosValidos = ['procesando', 'por-recoger', 'entregado', 'cancelado'];

    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ ok: false, mensaje: 'Estado inválido' });
    }

    const [rows] = await pool.query(
      'SELECT * FROM pedidos WHERE id = ?',
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Pedido no encontrado' });
    }

    // SI SE CANCELA DESDE ADMIN, DEVOLVER STOCK
    if (estado === 'cancelado' && rows[0].estado !== 'cancelado') {
      const [items] = await pool.query(
        'SELECT * FROM pedido_items WHERE pedido_id = ?',
        [req.params.id]
      );
      for (let item of items) {
        await pool.query(
          'UPDATE productos SET stock = stock + ? WHERE id = ?',
          [item.cantidad, item.producto_id]
        );
      }
    }

    await pool.query(
      'UPDATE pedidos SET estado = ? WHERE id = ?',
      [estado, req.params.id]
    );

    res.json({ ok: true, mensaje: 'Estado actualizado correctamente' });

  } catch (error) {
    console.error('Error cambiando estado:', error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

module.exports = { crear, listarMisPedidos, cancelar, listarTodos, cambiarEstado };