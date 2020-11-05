var express = require('express');
var router = express.Router();

router.post('/', function (req, res, next) {
    res.render('connection_error', { user_name: req.body['user_name'] });
});

module.exports = router;
