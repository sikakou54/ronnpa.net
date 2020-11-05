var express = require('express');
var router = express.Router();

router.post('/', function (req, res, next) {
    res.render('result_watcher', {
        user_name: req.body['user_name'],
        result_positive: req.body['result_positive'],
        result_negative: req.body['result_negative']
    });
});

module.exports = router;
