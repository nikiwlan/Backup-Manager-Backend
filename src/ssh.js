// https://github.com/mscdex/ssh2

const { readFileSync } = require('fs');
const { Client } = require('ssh2');
const conn = new Client();


// OPEN SHELL SESSION
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.shell((err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
      console.log('Stream :: close');
      conn.end();
    }).on('data', (data) => {
      console.log('OUTPUT: ' + data);
    });
    stream.end('hostname\rping 8.8.8.8\r');
  });
}).on("error", (err) => {
  console.log(err.stack)
}).connect({
  host: 'localhost',
  password: 'admin',
  privateKey: readFileSync('key/sample_key'),
  username: 'ssh_server',
});


// TRANSMIT FILE VIA SFTP
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.sftp(function (err, sftp) {
    if (err) {
      console.log("Error, problem starting SFTP: %s", err);
      process.exit(2);
    }

    console.log("SFTP :: started");

    // upload file
    var readStream = fs.createReadStream("folder/TEST.txt");
    var writeStream = sftp.createWriteStream("test.txt");

    // what to do when transfer finishes
    writeStream.on(
      'close',
      function () {
        console.log("SFTP :: file transferred");
        sftp.end();
        process.exit(0);
      }
    );

    // initiate transfer of file
    readStream.pipe(writeStream);
  });
}).on("error", (err) => {
  console.log(err.stack)
}).connect({
  host: 'localhost',
  password: 'admin',
  privateKey: readFileSync('key/sample_key'),
  username: 'ssh_server',
});

