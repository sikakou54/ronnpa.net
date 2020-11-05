var express = require('express');
var router = express.Router();

router.post('/', function (req, res, next) {
    res.render('result', {
        user_name: req.body['user_name'],
        result: req.body['result']
    });
});

module.exports = router;
