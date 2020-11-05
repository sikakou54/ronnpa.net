const async = require('async');
const { Client } = require('pg');
const setting = require('../setting/setting');

/**  Postgres SQLの最大接続数(20)から管理者を引いた19個を最大非同期処理カウントとする */
const QUEUQ_WORKER_COUNT = 19;

// 第一引数がqueueのパラメータ、第二引数が次のqueueの処理に入るトリガー
const q = async.queue((query, callback) => {

    let client = new Client(setting.DB_CONFIG);

    switch (query.action) {
        case 'select':

            console.log(query);

            client.connect(err => {
                if (err) {
                    console.error('connection error', err.stack);
                    callback(null, 0);
                } else {
                    client.query(query.sql, function (err, result) {
                        callback(result.rows, 1);
                        client.end();
                    });
                }
            });
            break;

        case 'insert':

            console.log(query);

            client.connect(err => {
                if (err) {
                    console.error('connection error', err.stack);
                    callback(null, 0);
                } else {
                    client.query(query.sql, query.values, function (err, res) {
                        callback(res, 1);
                        client.end();
                    });
                }
            });
            break;

        case 'delete':
            break;

        case 'update':
            break;

        default:
            break;
    }


}, QUEUQ_WORKER_COUNT);

/** QUEUE WRITE処理 */
function queue_push(query, callback) {
    q.push(query, callback);
}

module.exports = queue_push;