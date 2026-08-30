const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/categoriasController');
const { verificarToken, soloAdmin } = require('../middleware/authMiddleware');

// RUTA PÚBLICA
router.get('/', controller.listar);

// RUTAS SOLO ADMIN
router.post('/',       verificarToken, soloAdmin, controller.crear);
router.put('/:id',     verificarToken, soloAdmin, controller.actualizar);
router.delete('/:id',  verificarToken, soloAdmin, controller.eliminar);

module.exports = router;