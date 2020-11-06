var express = require('express');
var router = express.Router();
var db = require('../public/database/database');

//user/pw チェック
function admin_check(_user, _pw) {
    let dt = new Date();
    let ret = false;

    const str = (dt.getFullYear().toString() +
        (dt.getMonth() + 1).toString() +
        dt.getDate().toString());
    const PW = str.split('').reverse().join("");
    const USER = 'sikakou';

    if (USER == _user &&
        PW == _pw) {
        ret = true;
    }
    return ret;
}

router.get('/', function (req, res, next) {
    res.render('admin_login');
});

router.post('/menu', function (req, res, next) {

    if (true == admin_check(req.body['user'], req.body['pw'])) {
        res.render('admin_menu', { user: req.body['user'], pw: req.body['pw'] });
    } else {
        res.send('ミス');
    }
});

router.post('/theme', function (req, res, next) {

    res.render('admin_theme', { user: req.body['user'], pw: req.body['pw'] });
});

router.post('/theme_disp', function (req, res, next) {

    let query = {
        action: 'select',
        sql: 'select * from theme_tbl;'
    };

    db(query, function (data, result) {
        if (1 == result) {
            res.render('admin_theme_disp', { user: req.body['user'], pw: req.body['pw'], themes: data });
        } else {
            //エラー
        }
    });
});


router.post('/theme_add', function (req, res, next) {
    res.render('admin_theme_add', { user: req.body['user'], pw: req.body['pw'] });
});

router.post('/theme_add_result', function (req, res, next) {

    let query = {
        action: 'insert',
        sql: 'insert into theme_tbl(theme) values($1);',
        values: [req.body['theme']]
    };

    db(query, function (data, result) {

        if (1 == result) {

            console.log(data);

            res.render('admin_theme_result', { user: req.body['user'], pw: req.body['pw'], message: '登録完了' });

        } else {
            //エラー
        }
    });
});

module.exports = router;
