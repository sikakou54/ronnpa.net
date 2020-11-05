var express = require('express');
var router = express.Router();

router.post('/', function (req, res, next) {

    if ("視聴" == req.body['item_type']) {
        res.render('play_watcher', {
            roomID: req.body['roomID'],
            theme: req.body['theme'],
            item_type: req.body['item_type'],
            user_name: req.body['user_name']
        });
    } else {
        res.render('play', {
            roomID: req.body['roomID'],
            theme: req.body['theme'],
            item_type: req.body['item_type'],
            user_name: req.body['user_name']
        });
    }

});

module.exports = router;
