const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

const app = express();

// MIDDLEWARES
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ARCHIVOS ESTÁTICOS — imágenes subidas
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// RUTAS (las iremos agregando)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/productos',require('./routes/productos'));
app.use('/api/pedidos',  require('./routes/pedidos'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/categorias', require('./routes/categorias'));

// RUTA DE PRUEBA
app.get('/api/ping', function(req, res) {
  res.json({ ok: true, mensaje: 'Servidor Rojo Danés funcionando' });
});

module.exports = app;