"use strict";

const PLAY_TIME = 60;
const WATCHERS_MAX_COUNT = 1;

const MSG_TYPE_MASK = 0x000F;
const MSG_ID_MASK = 0xFFF0;

const MSG_TYPE_REQUEST = 0x0001;
const MSG_TYPE_RESPONSE = 0x0002;
const MSG_TYPE_RTC = 0x0004;

const MSGID_ROOM_ENTER = 0x0010;
const MSGID_MEDIA = 0x0020;
const MSGID_CONNECTION = 0x0040;
const MSGID_COMMUNICATION = 0x0080;
const MSGID_DISCONNECTION = 0x0100;
const MSGID_CANDIDATE_RETRY = 0x0200;
const MSGID_ROOM_JOIN_NOTIFY = 0x0400;
const MSGID_GAME_START = 0x0800;
const MSGID_TIMER_INTERVAL = 0x1000;
const MSGID_POINT_UP = 0x2000;
const MSGID_TIMEOUT = 0x4000;

const MSGID_ROOM_ENTER_REQ = MSGID_ROOM_ENTER | MSG_TYPE_REQUEST;
const MSGID_ROOM_ENTER_RES = MSGID_ROOM_ENTER | MSG_TYPE_RESPONSE;
const MSGID_MEDIA_REQ = MSGID_MEDIA | MSG_TYPE_REQUEST;
const MSGID_MEDIA_RES = MSGID_MEDIA | MSG_TYPE_RESPONSE;
const MSGID_CONNECTION_REQ = MSGID_CONNECTION | MSG_TYPE_REQUEST;
const MSGID_CONNECTION_RES = MSGID_CONNECTION | MSG_TYPE_RESPONSE;
const MSGID_DISCONNECTION_REQ = MSGID_DISCONNECTION | MSG_TYPE_REQUEST;
const MSGID_DISCONNECTION_RES = MSGID_DISCONNECTION | MSG_TYPE_RESPONSE;
const MSGID_COMMUNICATION_RTC = MSGID_COMMUNICATION | MSG_TYPE_RTC;
const MSGID_CANDIDATE_RETRY_RTC = MSGID_CANDIDATE_RETRY | MSG_TYPE_RTC;
const MSGID_ROOM_JOIN_NOTIFY_RTC = MSGID_ROOM_JOIN_NOTIFY | MSG_TYPE_RTC;
const MSGID_GAME_START_REQ = MSGID_GAME_START | MSG_TYPE_REQUEST;
const MSGID_GAME_START_RES = MSGID_GAME_START | MSG_TYPE_RESPONSE;
const MSGID_TIMER_INTERVAL_REQ = MSGID_TIMER_INTERVAL | MSG_TYPE_REQUEST;
const MSGID_TIMER_INTERVAL_RES = MSGID_TIMER_INTERVAL | MSG_TYPE_RESPONSE;
const MSGID_POINT_UP_REQ = MSGID_POINT_UP | MSG_TYPE_REQUEST;
const MSGID_POINT_UP_RES = MSGID_POINT_UP | MSG_TYPE_RESPONSE;
const MSGID_TIMEOUT_REQ = MSGID_TIMEOUT | MSG_TYPE_REQUEST;
const MSGID_TIMEOUT_RES = MSGID_TIMEOUT | MSG_TYPE_RESPONSE;

const user_type = document.getElementById('play_input_type').textContent;
const user_room = document.getElementById('play_input_roomID').textContent;
const user_name = document.getElementById('play_input_user_name').textContent;
const ul_log = document.getElementById('play_room_log');

class WebRTC {

    constructor(_destination, _connection) {
        this.destination = _destination;
        this.connection = _connection;
        this.elm_audio = null;
    }
}

class buff {
    constructor(_destination, _buff) {
        this.destination = _destination;
        this.buff = _buff;
    }
}

let socket = null;
let myStream = null;
let WebRTCConnection = [];
let Candidate_buff = [];
let tim_start = null;
let tim_now = null;
let timer = null;

/** ユーザー種別文字列のインデック変換処理 */
function getUserTypeId(_user_type_str) {
    let id = -1;
    switch (_user_type_str) {
        case "肯定":
            id = 0;
            break;
        case "否定":
            id = 1;
            break;
        case "視聴":
            id = 2;
            break;
        default:
            id = -1;
            break;
    }
    return id;
}

function createMessage(_sender, _destination, _msgid, _data) {

    let obj = {
        header: {
            sender: _sender,
            destination: _destination,
            msgid: _msgid
        },
        data: _data
    }

    return JSON.stringify(obj);
}

/** ビデオを開始する・例外ハンドリングは呼び出し元の #start-button のクリックイベントで行う */
function getUserMedia() {

    navigator.getUserMedia = navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia;

    if (navigator.getUserMedia) {
        navigator.getUserMedia({ video: false, audio: true },
            function (stream) {
                myStream = stream;
                let msg = createMessage(socket.id, 'admin', MSGID_MEDIA_RES, { user_type: getUserTypeId(user_type.trim()), room_id: user_room });
                socket.emit('message', msg);
            },
            function (err) {
                ////////////console.log("error", err );
            }
        )
    }
}

function CreatePeerConnection(_destination) {
    let NewConnection = null;

    NewConnection = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

    if (myStream != null) {
        myStream.getTracks().forEach((track) => {
            NewConnection.addTrack(track, myStream);
        });
    }

    NewConnection.onnegotiationneeded = function () {
        ////////console.log('onnegotiationneeded', NewConnection );
    };

    NewConnection.onicecandidate = function (event) {
        if (event.candidate) {
            ////////console.log('onicecandidate', NewConnection, socket.id, _destination );
            let msg = createMessage(socket.id, _destination, MSGID_COMMUNICATION_RTC, { type: 'candidate', candidate: event.candidate });
            socket.emit('message', msg);
        } else {
            ////////console.log('candidate-end', NewConnection, socket.id, _destination );
        }
    };

    NewConnection.onconnectionstatechange = function (event) {

        //console.log('onconnectionstatechange', socket.id, _destination, NewConnection.connectionState);

        switch (NewConnection.connectionState) {
            case "connected":
                let msg = createMessage(socket.id, _destination, MSGID_CONNECTION_RES, { room_id: user_room, state: NewConnection.connectionState });
                socket.emit('message', msg);
                break;
            case "disconnected":
                break;
            case "failed":
                // One or more transports has terminated unexpectedly or in an error
                break;
            case "closed":
                // The connection has been closed
                break;
            default:
                break;
        }
    }

    return (new WebRTC(_destination, NewConnection));
}

function getRTCConnection(sender) {
    let connection;

    for (let i = 0; i < WebRTCConnection.length; i++) {
        if (sender == WebRTCConnection[i].destination) {
            connection = WebRTCConnection[i];
            break;
        }
    }

    return connection;
}

window.addEventListener('beforeunload', function (e) {

    /** ソケットが空いていたら閉じる */
    if (null != socket) {
        socket.disconnect();
    }

    /** タイマーが動いていたら止める */
    if (null != timer) {
        window.clearInterval(timer);
        timer = null;
    }

    /** connectionを閉じる/オーディオを止める */
    for (let i = 0; i < WebRTCConnection.length; i++) {
        if (null != WebRTCConnection[i].connection) {
            WebRTCConnection[i].connection.close();
            WebRTCConnection[i].connection = null;
        }
        if (null != WebRTCConnection[i].elm_audio) {
            WebRTCConnection[i].elm_audio.srcObject = null;
        }
        WebRTCConnection.splice(i, 1);
    }

    /** クライアントがデベロッパーを開いてセッションを消した場合の対処 */
    if ('idle' != sessionStorage.getItem('state')) {
        /**　stateを例外に設定する */
        sessionStorage.setItem('state', 'except');
    }
});

window.addEventListener('DOMContentLoaded', () => {

    /** セッションストレージを取得する */
    let state = sessionStorage.getItem('state');

    if (null == state) {
        sessionStorage.setItem('state', 'idle');
    }
    else {

        /** セッションストレージをクリア */
        sessionStorage.clear();

        /** 通信エラー画面へ */
        document.connection_error.submit();

        /** 後続処理は行わない */
        return;
    }

    socket = window.io();
    myStream = null;

    socket.on('connect', async function () {

        console.log('connect', socket.id);

        if (2 != getUserTypeId(user_type.trim())) {
            document.getElementById('state_remote').textContent = 'オフライン';
            document.getElementById('state_remote').style.backgroundColor = 'gray';
        } else {
            document.getElementById('state_local').textContent = 'オフライン';
            document.getElementById('state_local').style.backgroundColor = 'gray';
            document.getElementById('state_remote').textContent = 'オフライン';
            document.getElementById('state_remote').style.backgroundColor = 'gray';
        }

        let msg = createMessage(socket.id, 'admin', MSGID_ROOM_ENTER_REQ, { room_id: user_room, room_type: getUserTypeId(user_type.trim()), user_name: user_name });
        socket.emit('message', msg);
    });

    socket.on('message', async function (_message) {

        ////console.log('message', _message);

        let message = JSON.parse(_message);

        switch (message.header.msgid & MSG_ID_MASK) {

            /** ENTER要求 */
            case MSGID_ROOM_ENTER:
                if (MSG_TYPE_RESPONSE == (message.header.msgid & MSG_TYPE_MASK)) {
                    if (false == message.data.room_join_result) {

                        /** セッションストレージをクリア */
                        sessionStorage.clear();

                        /** 通信エラー画面へ */
                        document.connection_error.submit();
                    }
                }
                break;

            /** ROOM参加通知 */
            case MSGID_ROOM_JOIN_NOTIFY:
                if (MSG_TYPE_RTC == (message.header.msgid & MSG_TYPE_MASK)) {
                    if (ul_log.childElementCount > 10) {
                        ul_log.removeChild(ul_log.lastElementChild);
                    }
                    const li_text = document.createElement('li');
                    const objTime = new Date();
                    li_text.textContent = objTime.getHours() + ':' + objTime.getMinutes() + ':' + objTime.getSeconds() + message.data.user_name + 'さんが入室しました';
                    ul_log.prepend(li_text);
                }
                break;

            /** MEDIA要求 */
            case MSGID_MEDIA:
                if (MSG_TYPE_REQUEST == (message.header.msgid & MSG_TYPE_MASK)) {
                    getUserMedia();
                }
                break;

            /** RTC接続要求 */
            case MSGID_CONNECTION:
                if (MSG_TYPE_REQUEST == (message.header.msgid & MSG_TYPE_MASK)) {

                    let NewConnection = null;
                    let mediaConstraints = null;

                    for (let i = 0; i < WebRTCConnection.length; i++) {
                        if (message.header.destination == WebRTCConnection[i].destination) {
                            NewConnection = WebRTCConnection[i];
                            break;
                        }
                    }

                    if (null == NewConnection) {
                        /** 新しいConnectionを作成しofferを作成する */
                        NewConnection = CreatePeerConnection(message.header.destination);
                    }

                    if ("connected" == NewConnection.connection.connectionState) {
                        let msg = createMessage(socket.id, message.header.destination, MSGID_CONNECTION_RES, { room_id: user_room, state: NewConnection.connection.connectionState });
                        socket.emit('message', msg);
                    }

                    /** 視聴者で無い場合ストリームを設定する */
                    if (2 != message.data.user_type) {

                        /* ビデオオブジェクトを設定する */
                        NewConnection.elm_audio = document.getElementById('video_remote');

                        /** 配信者はリモートビデオにストリームを設定するように指定する */
                        NewConnection.connection.ontrack = function (event) {
                            //console.log('ontrack', event, video_remote);
                            if (NewConnection.elm_audio.srcObject == null) {
                                NewConnection.elm_audio.srcObject = event.streams[0];
                                document.getElementById('state_remote').textContent = 'オンライン'
                                document.getElementById('state_remote').style.backgroundColor = 'aquamarine';
                            }
                        };
                    }

                    /** 配信者と視聴者の接続の場合は、視聴者にビデオと音声を求めない指定をする */
                    if (true == message.data.isWacther) {
                        mediaConstraints = { 'mandatory': { 'OfferToReceiveAudio': false, 'OfferToReceiveVideo': false } };
                    } else {
                        mediaConstraints = { 'mandatory': { 'OfferToReceiveAudio': true, 'OfferToReceiveVideo': true } };
                    }

                    /** オファーを作成し送信する */
                    NewConnection.connection.createOffer(function (offer) {
                        NewConnection.connection.setLocalDescription(offer);
                        let msg = createMessage(message.header.sender, message.header.destination, MSGID_COMMUNICATION_RTC, { type: 'offer', sdp: NewConnection.connection.localDescription, user_type: getUserTypeId(user_type.trim()) });
                        socket.emit('message', msg);

                        WebRTCConnection.push(NewConnection);
                    }, function (error) {
                        //console.warn('offer create error', error, NewConnection);
                    }, mediaConstraints);
                }
                break;

            /** RTC通信 */
            case MSGID_COMMUNICATION:
                if (MSG_TYPE_RTC == (message.header.msgid & MSG_TYPE_MASK)) {
                    switch (message.data.type) {
                        case 'offer':
                            let NewConnection = null;

                            for (let i = 0; i < WebRTCConnection.length; i++) {
                                if (message.header.sender == WebRTCConnection[i].destination) {
                                    NewConnection = WebRTCConnection[i];
                                    break;
                                }
                            }

                            if (null == NewConnection) {
                                NewConnection = CreatePeerConnection(message.header.sender);
                            }

                            if ("connected" == NewConnection.connection.connectionState) {
                                let msg = createMessage(socket.id, NewConnection.destination, MSGID_CONNECTION_RES, { room_id: user_room, state: NewConnection.connection.connectionState });
                                socket.emit('message', msg);
                            }
                            /** 配信者側の場合はリモートビデオに相手のストリームを指定する */
                            if (0 == getUserTypeId(user_type.trim()) ||
                                1 == getUserTypeId(user_type.trim())) {

                                /** 接続相手の種別が市著の場合ストリームの設定が不要 */
                                if (2 != message.data.user_type) {
                                    /* ビデオオブジェクトを設定する */
                                    NewConnection.elm_audio = document.getElementById('video_remote');
                                    NewConnection.connection.ontrack = function (event) {
                                        //console.log('ontrack', event, video_remote);
                                        if (NewConnection.elm_audio.srcObject == null) {
                                            NewConnection.elm_audio.srcObject = event.streams[0];
                                            document.getElementById('state_remote').textContent = 'オンライン'
                                            document.getElementById('state_remote').style.backgroundColor = 'aquamarine';
                                        }
                                    };
                                }

                            } else if (2 == getUserTypeId(user_type.trim())) {

                                /** 視聴者で接続相手が肯定の場合ローカルビデオに相手のストリームを指定する */
                                if (0 == message.data.user_type) {
                                    /* ビデオオブジェクトを設定する */
                                    NewConnection.elm_audio = document.getElementById('video_local');
                                    NewConnection.connection.ontrack = function (event) {
                                        //console.log('ontrack -> positive', event, video_local.srcObject);
                                        if (NewConnection.elm_audio.srcObject == null) {
                                            NewConnection.elm_audio.srcObject = event.streams[0];
                                            document.getElementById('state_local').textContent = 'オンライン'
                                            document.getElementById('state_local').style.backgroundColor = 'aquamarine';
                                        }
                                    };

                                    /** 視聴者で接続相手が否定の場合リモートビデオに相手のストリームを指定する */
                                } else if (1 == message.data.user_type) {
                                    /* ビデオオブジェクトを設定する */
                                    NewConnection.elm_audio = document.getElementById('video_remote');
                                    NewConnection.connection.ontrack = function (event) {
                                        //console.log('ontrack -> negative', event, video_remote.srcObject);
                                        if (NewConnection.elm_audio.srcObject == null) {
                                            NewConnection.elm_audio.srcObject = event.streams[0];
                                            document.getElementById('state_remote').textContent = 'オンライン'
                                            document.getElementById('state_remote').style.backgroundColor = 'aquamarine';
                                        }
                                    };
                                }
                            }

                            try {
                                await NewConnection.connection.setRemoteDescription(new RTCSessionDescription(message.data.sdp));
                            } catch (error) {
                                ////console.warn('err', error, NewConnection);
                            }

                            NewConnection.connection.createAnswer(function (answer) {
                                NewConnection.connection.setLocalDescription(answer);
                                let msg = createMessage(message.header.destination, message.header.sender, MSGID_COMMUNICATION_RTC, { type: 'answer', sdp: NewConnection.connection.localDescription });
                                socket.emit('message', msg);
                                WebRTCConnection.push(NewConnection);
                            }, function (error) {
                                ////console.warn('offer create error', error, NewConnection);
                            });
                            break;

                        case 'answer':
                            for (let i = 0; i < WebRTCConnection.length; i++) {
                                if (message.header.sender == WebRTCConnection[i].destination) {
                                    try {
                                        await WebRTCConnection[i].connection.setRemoteDescription(new RTCSessionDescription(message.data.sdp));
                                    } catch (error) {
                                        ////console.warn('err', error, WebRTCConnection[i]);
                                    }
                                    let msg = createMessage(message.header.destination, message.header.sender, MSGID_CANDIDATE_RETRY_RTC, { dummy: null });
                                    socket.emit('message', msg);
                                    break;
                                }
                            }
                            break;

                        case 'candidate':
                            let connection = null;

                            for (let i = 0; i < WebRTCConnection.length; i++) {
                                if (message.header.sender == WebRTCConnection[i].destination &&
                                    null != WebRTCConnection[i].connection.remoteDescription.type) {
                                    connection = WebRTCConnection[i];
                                    try {
                                        connection.connection.addIceCandidate(new RTCIceCandidate(message.data.candidate));
                                    } catch (error) {
                                        //console.warn('err', error, connection);
                                    }
                                    break;
                                }
                            }
                            if (null == connection) {
                                Candidate_buff.push(new buff(message.header.sender, message.data.candidate));
                            }
                            break;
                        default:
                            break;
                    }
                }
                break;

            /** CANDIDATE再登録通知 */
            case MSGID_CANDIDATE_RETRY:
                if (MSG_TYPE_RTC == (message.header.msgid & MSG_TYPE_MASK)) {
                    for (let i = 0; i < WebRTCConnection.length; i++) {
                        if (message.header.sender == WebRTCConnection[i].destination) {
                            for (let buff = 0; buff < Candidate_buff.length; buff++) {
                                if (Candidate_buff[buff].destination == WebRTCConnection[i].destination) {
                                    try {
                                        WebRTCConnection[i].connection.addIceCandidate(new RTCIceCandidate(Candidate_buff[buff].buff));
                                    } catch (error) {
                                        //console.warn('err', error, WebRTCConnection[i]);
                                    }
                                }
                            }
                            break;
                        }
                    }
                }
                break;

            /** 切断通知 */
            case MSGID_DISCONNECTION:
                if (MSG_TYPE_REQUEST == (message.header.msgid & MSG_TYPE_MASK)) {

                    if ('started' != message.data.room_state) {

                        /** 切断したユーザーの接続をcloseし配列も削除する */
                        for (let i = 0; i < WebRTCConnection.length; i++) {
                            if (message.data.disconnect_socket == WebRTCConnection[i].destination) {
                                if (null != WebRTCConnection[i].connection) {
                                    if (null != WebRTCConnection[i].elm_audio) {
                                        WebRTCConnection[i].elm_audio.srcObject = null;
                                        if ('video_local' == WebRTCConnection[i].elm_audio.id) {
                                            document.getElementById('state_local').textContent = 'オフライン'
                                            document.getElementById('state_local').style.backgroundColor = 'gray';
                                        } else if ('video_remote' == WebRTCConnection[i].elm_audio.id) {
                                            document.getElementById('state_remote').textContent = 'オフライン'
                                            document.getElementById('state_remote').style.backgroundColor = 'gray';
                                        }
                                    }
                                    WebRTCConnection[i].connection.close();
                                    WebRTCConnection.splice(i, 1);
                                    break;
                                }
                            }
                        }
                    } else {
                        /** 肯定/否定の切断の場合ゲームを続けられないので通信エラーとする */
                        if (2 != message.data.user_type) {

                            /** タイマー終了 */
                            window.clearInterval(timer);
                            timer = null;

                            /** ステータスを初期化する */
                            document.getElementById('state_remote').textContent = 'オフライン'
                            document.getElementById('state_remote').style.backgroundColor = 'gray';

                            /** connectionを閉じる/オーディオを止める */
                            for (let i = 0; i < WebRTCConnection.length; i++) {
                                if (null != WebRTCConnection[i].connection) {
                                    WebRTCConnection[i].connection.close();
                                    WebRTCConnection[i].connection = null;
                                }
                                if (null != WebRTCConnection[i].elm_audio) {
                                    WebRTCConnection[i].elm_audio.srcObject = null;
                                }
                                WebRTCConnection.splice(i, 1);
                            }

                            /** セッションストレージをクリア */
                            sessionStorage.clear();

                            /** エラー遷移 */
                            document.connection_error.submit();
                        }
                    }
                    if (ul_log.childElementCount > 10) {
                        ul_log.removeChild(ul_log.lastElementChild);
                    }
                    const li_text = document.createElement('li');
                    const objTime = new Date();
                    li_text.textContent = objTime.getHours() + ':' + objTime.getMinutes() + ':' + objTime.getSeconds() + message.data.user_name + 'さんが退室しました';
                    ul_log.prepend(li_text);
                }
                break;
            case MSGID_GAME_START:
                if (MSG_TYPE_REQUEST == (message.header.msgid & MSG_TYPE_MASK)) {
                    if (2 != getUserTypeId(user_type.trim())) {
                        document.getElementById('state_remote').style.backgroundColor = 'red';
                    } else {
                        document.getElementById('state_local').style.backgroundColor = 'red';
                        document.getElementById('state_remote').style.backgroundColor = 'red';
                    }
                }
                /** 肯定の場合はゲームタイマーを開始する */
                if (0 == getUserTypeId(user_type.trim())) {
                    if (null != timer) {
                        window.clearInterval(timer);
                    }
                    tim_start = Date.now();
                    timer = window.setInterval(function () {

                        let time = Math.floor((Date.now() - tim_start) / 1000);

                        if (time > PLAY_TIME) {
                            /** タイマー終了 */
                            window.clearInterval(timer);

                            /** 初期化 */
                            timer = null;

                            /** タイマータイムアウト通知 */
                            let msg = createMessage(socket.id, 'admin', MSGID_TIMEOUT_REQ, { room_id: user_room, time: time });
                            socket.emit('message', msg);

                        } else {
                            let msg = createMessage(socket.id, 'admin', MSGID_TIMER_INTERVAL_REQ, { room_id: user_room, time: time });
                            socket.emit('message', msg);
                        }
                    }, 1000);

                } else if (2 == getUserTypeId(user_type.trim())) {
                    console.log('start');
                    document.getElementById('local_area').onclick = function () {
                        let msg = createMessage(socket.id, 'admin', MSGID_POINT_UP_REQ, { room_id: user_room, point_target: 0 });
                        socket.emit('message', msg);
                    };
                    document.getElementById('remote_area').onclick = function () {
                        let msg = createMessage(socket.id, 'admin', MSGID_POINT_UP_REQ, { room_id: user_room, point_target: 1 });
                        socket.emit('message', msg);
                    };
                    document.getElementById('local_area').addEventListener('mouseenter', function () {
                        document.getElementById('local_area').style.backgroundColor = 'blue';
                    });
                    document.getElementById('remote_area').addEventListener('mouseenter', function () {
                        document.getElementById('remote_area').style.backgroundColor = 'blue';
                    });
                    document.getElementById('local_area').addEventListener('mouseleave', function () {
                        document.getElementById('local_area').style.backgroundColor = 'transparent';
                    });
                    document.getElementById('remote_area').addEventListener('mouseleave', function () {
                        document.getElementById('remote_area').style.backgroundColor = 'transparent';
                    });
                }
                break;
            case MSGID_TIMER_INTERVAL:
                if (MSG_TYPE_RESPONSE == (message.header.msgid & MSG_TYPE_MASK)) {
                    let elm_tim = document.getElementById('timer');
                    elm_tim.textContent = message.data.time;
                }
                break;

            case MSGID_POINT_UP:
                if (MSG_TYPE_RESPONSE == (message.header.msgid & MSG_TYPE_MASK)) {
                    let elm_point = document.getElementById('point');
                    elm_point.textContent = message.data.point;
                }
                break;

            case MSGID_TIMEOUT:
                if (MSG_TYPE_RESPONSE == (message.header.msgid & MSG_TYPE_MASK)) {
                    let elm_tim = document.getElementById('timer');
                    elm_tim.textContent = '～ゲーム終了～';

                    /** connectionを閉じる/オーディオを止める */
                    for (let i = 0; i < WebRTCConnection.length; i++) {
                        if (null != WebRTCConnection[i].connection) {
                            WebRTCConnection[i].connection.close();
                            WebRTCConnection[i].connection = null;
                        }
                        if (null != WebRTCConnection[i].elm_audio) {
                            WebRTCConnection[i].elm_audio.srcObject = null;
                        }
                        WebRTCConnection.splice(i, 1);
                    }

                    if (0 == getUserTypeId(user_type.trim())) {
                        if (message.data.positive > message.data.negative) {
                            document.form_result.result.value = "WIN";
                        } else if (message.data.positive < message.data.negative) {
                            document.form_result.result.value = "LOSE";
                        } else if (message.data.positive == message.data.negative) {
                            document.form_result.result.value = "DRAW";
                        } else {
                            //ここはない
                        }
                    } else if (1 == getUserTypeId(user_type.trim())) {
                        if (message.data.positive > message.data.negative) {
                            document.form_result.result.value = "LOSE";
                        } else if (message.data.positive < message.data.negative) {
                            document.form_result.result.value = "WIN";
                        } else if (message.data.positive == message.data.negative) {
                            document.form_result.result.value = "DRAW";
                        } else {
                            //ここはない
                        }
                    } else if (2 == getUserTypeId(user_type.trim())) {
                        if (message.data.positive > message.data.negative) {
                            document.form_result.result_positive.value = "WIN";
                            document.form_result.result_negative.value = "LOSE";
                        } else if (message.data.positive < message.data.negative) {
                            document.form_result.result_positive.value = "LOSE";
                            document.form_result.result_negative.value = "WIN";
                        } else if (message.data.positive == message.data.negative) {
                            document.form_result.result_positive.value = "DRAW";
                            document.form_result.result_negative.value = "DRAW";
                        } else {
                            //ここはない
                        }
                    }

                    /** セッションストレージをクリア */
                    sessionStorage.clear();

                    /** 結果発表へ遷移 */
                    document.form_result.submit();
                }
                break;

            default:
                break;
        }
    });
});