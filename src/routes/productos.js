const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/productosController');
const { verificarToken, soloAdmin } = require('../middleware/authMiddleware');
const multer     = require('multer');
const path       = require('path');

// CONFIGURAR MULTER PARA SUBIDA DE IMÁGENES
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'uploads/productos/');
  },
  filename: function(req, file, cb) {
    const ext      = path.extname(file.originalname);
    const filename = 'prod_' + Date.now() + ext;
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB máximo
  fileFilter: function(req, file, cb) {
    const tipos = /jpeg|jpg|png|webp|gif/;
    const esValido = tipos.test(path.extname(file.originalname).toLowerCase());
    if (esValido) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  }
});

// RUTAS PÚBLICAS
router.get('/',           controller.listar);
router.get('/grupos',     controller.listarGrupos);
router.get('/:id',        controller.obtener);

// RUTAS SOLO ADMIN
router.post('/',                          verificarToken, soloAdmin, upload.single('imagen'), controller.crear);
router.put('/:id',                        verificarToken, soloAdmin, upload.single('imagen'), controller.actualizar);
router.delete('/:id',                     verificarToken, soloAdmin, controller.eliminar);
router.patch('/:id/stock',                verificarToken, soloAdmin, controller.actualizarStock);
router.post('/grupos/crear',              verificarToken, soloAdmin, controller.crearGrupo);

module.exports = router;