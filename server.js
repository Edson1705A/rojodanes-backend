const app  = require('./src/app');
const pool = require('./src/config/db');
require('dotenv').config();

const PORT = process.env.PORT || 3000;

async function iniciarServidor() {
  try {
    // VERIFICAR CONEXIÓN A LA BASE DE DATOS
    const conn = await pool.getConnection();
    console.log('✅ Conexión a MySQL exitosa');
    conn.release();

    // INICIAR SERVIDOR
    app.listen(PORT, function() {
      console.log('🚀 Servidor corriendo en http://localhost:' + PORT);
    });

  } catch (error) {
    console.error('❌ Error al conectar con MySQL:', error.message);
    process.exit(1);
  }
}

iniciarServidor();