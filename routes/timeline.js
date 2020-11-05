var express = require('express');
var router = express.Router();
var db = require('../public/database/database');

/* GET home page. */
router.get('/', function (req, res, next) {
    console.log('timeline GET..');
});

router.post('/', function (req, res, next) {

    let query = {
        action: 'select',
        sql: 'select * from theme_tbl;'
    };

    db(query, function (data, result) {
        if (1 == result) {
            res.render('timeline', { timelines: data, user_name: req.body['user_name'] });
        } else {
            //エラー
        }
    });
});

module.exports = router;
