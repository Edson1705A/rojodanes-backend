const jwt = require('jsonwebtoken');
require('dotenv').config();

function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ ok: false, mensaje: 'Token requerido' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ ok: false, mensaje: 'Token inválido o expirado' });
  }
}

function soloAdmin(req, res, next) {
  if (!req.usuario || !req.usuario.es_admin) {
    return res.status(403).json({ ok: false, mensaje: 'Acceso solo para administradores' });
  }
  next();
}

module.exports = { verificarToken, soloAdmin };