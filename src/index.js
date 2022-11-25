// SOURCE:
// https://stackoverflow.com/questions/50372083/create-a-node-ssh2-server-with-ability-to-treat-remote-forwarding

var fs = require('fs');
// var crypto = require('crypto');
var inspect = require('util').inspect;

//var buffersEqual = require('buffer-equal-constant-time');
var ssh2 = require('ssh2');
//var utils = ssh2.utils;

new ssh2.Server({
    hostKeys: [fs.readFileSync('key/id_rsa')]
}, function (client) {
    console.log('Client connected!');

    client.on('authentication', function (ctx) {
        if (ctx.method === 'password' &&
            ctx.username === 'foo' &&
            ctx.password === 'bar')
            ctx.accept();
        else
            ctx.reject();
    }).on('ready', function () {
        console.log('Client authenticated!');

        client.on('session', function (accept, reject) {
            var session = accept();
            session.once('exec', function (accept, reject, info) {
                console.log('Client wants to execute: ' + inspect(info.command));
                var stream = accept();
                stream.stderr.write('Oh no, the dreaded errors!\n');
                stream.write('Just kidding about the errors!\n');
                stream.exit(0);
                stream.end();
            });
        });
        client.on('request', function (accept, reject, name, info) {
            console.log(info);
            if (name === 'tcpip-forward') {
                accept();
                setTimeout(function () {
                    console.log('Sending incoming tcpip forward');
                    client.forwardIn(info.bindAddr,
                        info.bindPort,
                        function (err, stream) {
                            if (err)
                                return;
                            stream.end('hello world\n');
                        });
                }, 1000);
            } else {
                reject();
            }
        });
    });
}).listen(5000, 'localhost', function () {
    // Connect via following command in cmd:
    // ssh foo@localhost -p 5000
    console.log('Listening on port ' + this.address().port);
});
