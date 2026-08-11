const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/authController');
const { verificarToken } = require('../middleware/authMiddleware');

// RUTAS PÚBLICAS
router.post('/registro', controller.registro);
router.post('/login',    controller.login);

// RUTAS PROTEGIDAS
router.get('/perfil',  verificarToken, controller.perfil);
router.put('/perfil',  verificarToken, controller.actualizarPerfil);

module.exports = router;