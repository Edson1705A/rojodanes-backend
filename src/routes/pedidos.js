const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/pedidosController');
const { verificarToken, soloAdmin } = require('../middleware/authMiddleware');

// RUTAS PROTEGIDAS — usuario logueado
router.post('/',           verificarToken, controller.crear);
router.get('/mis-pedidos', verificarToken, controller.listarMisPedidos);
router.patch('/:id/cancelar', verificarToken, controller.cancelar);

// RUTAS SOLO ADMIN
router.get('/todos',          verificarToken, soloAdmin, controller.listarTodos);
router.patch('/:id/estado',   verificarToken, soloAdmin, controller.cambiarEstado);

module.exports = router;