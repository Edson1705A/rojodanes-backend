const pool    = require('../config/db');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
require('dotenv').config();

// GENERAR ID PÚBLICO ÚNICO
async function generarIdPublico() {
  const [rows] = await pool.query('SELECT COUNT(*) as total FROM usuarios');
  const total  = rows[0].total + 1;
  return 'RD-' + String(1000 + total).padStart(4, '0');
}

// REGISTRO
async function registro(req, res) {
  try {
    const { nombre, username, correo, telefono, dni, password } = req.body;

    // VALIDACIONES
    if (!nombre || !username || !correo || !password) {
      return res.status(400).json({ ok: false, mensaje: 'Completa todos los campos obligatorios' });
    }
    if (password.length < 6) {
      return res.status(400).json({ ok: false, mensaje: 'La contraseña debe tener al menos 6 caracteres' });
    }

    // VERIFICAR SI YA EXISTE
    const [existe] = await pool.query(
      'SELECT id FROM usuarios WHERE correo = ? OR username = ?',
      [correo, username]
    );
    if (existe.length > 0) {
      return res.status(409).json({ ok: false, mensaje: 'El correo o usuario ya está registrado' });
    }

    // ENCRIPTAR CONTRASEÑA
    const hash      = await bcrypt.hash(password, 10);
    const idPublico = await generarIdPublico();

    // GUARDAR USUARIO
    const [result] = await pool.query(
      `INSERT INTO usuarios (id_publico, nombre, username, correo, telefono, dni, password)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [idPublico, nombre, username, correo, telefono || null, dni || null, hash]
    );

    // GENERAR TOKEN
    const token = jwt.sign(
      { id: result.insertId, username, correo, es_admin: false },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES }
    );

    res.status(201).json({
      ok: true,
      mensaje: 'Cuenta creada exitosamente',
      token,
      usuario: {
        id:        result.insertId,
        idPublico,
        nombre,
        username,
        correo,
        es_admin:  false
      }
    });

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// LOGIN
async function login(req, res) {
  try {
    const { identificador, password } = req.body;

    if (!identificador || !password) {
      return res.status(400).json({ ok: false, mensaje: 'Completa todos los campos' });
    }

    // VERIFICAR SI ES ADMIN
    if (identificador === 'Admin2026RD') {
      const [adminRows] = await pool.query(
        'SELECT * FROM admin_cuenta WHERE username = ?',
        ['Admin2026RD']
      );

      // Si no existe en DB todavía, lo creamos la primera vez
      if (adminRows.length === 0) {
        const hashAdmin = await bcrypt.hash('RD@2026', 10);
        await pool.query(
          'INSERT INTO admin_cuenta (username, password) VALUES (?, ?)',
          ['Admin2026RD', hashAdmin]
        );
      }

      const admin     = adminRows[0];
      const passValida = adminRows.length > 0
        ? await bcrypt.compare(password, admin.password)
        : password === 'RD@2026';

      if (!passValida) {
        return res.status(401).json({ ok: false, mensaje: 'Credenciales incorrectas' });
      }

      const token = jwt.sign(
        { id: 0, username: 'Admin2026RD', correo: 'admin@rojodanes.com', es_admin: true },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES }
      );

      return res.json({
        ok: true,
        token,
        usuario: {
          id:       0,
          nombre:   'Administrador',
          username: 'Admin2026RD',
          correo:   'admin@rojodanes.com',
          es_admin: true
        }
      });
    }

    // BUSCAR USUARIO NORMAL
    const [rows] = await pool.query(
      `SELECT * FROM usuarios
       WHERE correo = ? OR username = ? OR telefono = ?`,
      [identificador, identificador, identificador]
    );

    if (rows.length === 0) {
      return res.status(401).json({ ok: false, mensaje: 'Datos incorrectos. Verifica e intenta de nuevo' });
    }

    const usuario = rows[0];

    // VERIFICAR BLOQUEO
    if (usuario.bloqueado) {
      return res.status(403).json({ ok: false, mensaje: 'Tu cuenta ha sido suspendida. Contacta al administrador' });
    }

    // VERIFICAR CONTRASEÑA
    const passValida = await bcrypt.compare(password, usuario.password);
    if (!passValida) {
      return res.status(401).json({ ok: false, mensaje: 'Datos incorrectos. Verifica e intenta de nuevo' });
    }

    // GENERAR TOKEN
    const token = jwt.sign(
      { id: usuario.id, username: usuario.username, correo: usuario.correo, es_admin: false },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES }
    );

    res.json({
      ok: true,
      token,
      usuario: {
        id:           usuario.id,
        idPublico:    usuario.id_publico,
        nombre:       usuario.nombre,
        username:     usuario.username,
        correo:       usuario.correo,
        telefono:     usuario.telefono,
        dni:          usuario.dni,
        fechaRegistro: usuario.fecha_registro,
        es_admin:     false
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// OBTENER PERFIL ACTUAL
async function perfil(req, res) {
  try {
    if (req.usuario.es_admin) {
      return res.json({
        ok: true,
        usuario: {
          id:       0,
          nombre:   'Administrador',
          username: 'Admin2026RD',
          correo:   'admin@rojodanes.com',
          es_admin: true
        }
      });
    }

    const [rows] = await pool.query(
      'SELECT id, id_publico, nombre, username, correo, telefono, dni, fecha_registro FROM usuarios WHERE id = ?',
      [req.usuario.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' });
    }

    res.json({ ok: true, usuario: rows[0] });

  } catch (error) {
    console.error('Error en perfil:', error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ACTUALIZAR PERFIL
async function actualizarPerfil(req, res) {
  try {
    const { nombre, telefono } = req.body;

    if (!nombre) {
      return res.status(400).json({ ok: false, mensaje: 'El nombre no puede estar vacío' });
    }

    await pool.query(
      'UPDATE usuarios SET nombre = ?, telefono = ? WHERE id = ?',
      [nombre, telefono || null, req.usuario.id]
    );

    res.json({ ok: true, mensaje: 'Perfil actualizado correctamente' });

  } catch (error) {
    console.error('Error actualizando perfil:', error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

module.exports = { registro, login, perfil, actualizarPerfil };