const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/usuariosController');
const { verificarToken, soloAdmin } = require('../middleware/authMiddleware');

// TODAS SON SOLO ADMIN
router.get('/',                    verificarToken, soloAdmin, controller.listar);
router.get('/estadisticas',        verificarToken, soloAdmin, controller.estadisticas);
router.get('/:id',                 verificarToken, soloAdmin, controller.obtener);
router.patch('/:id/bloquear',      verificarToken, soloAdmin, controller.toggleBloquear);

module.exports = router;