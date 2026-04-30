const express = require('express');
const router = express.Router();
const { login, obtenerContextoLogin } = require('../controllers/authController');

router.get('/contexto', obtenerContextoLogin);
router.post('/login', login);

module.exports = router;
