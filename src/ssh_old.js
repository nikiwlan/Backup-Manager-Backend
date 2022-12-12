// This file is for reference purposes
// Will be deleted later

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
// not recommended ---> ssh2-sftp-client is easier (see below)
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

// ==============================================================================

// https://github.com/theophilusx/ssh2-sftp-client

let sftpClient = require('ssh2-sftp-client');
let sftp = new sftpClient();

let data_ = 'write.json';
let data = fs.createReadStream(data_);
let remote_write = 'some_folder/write.json';

let remote_read = 'some_folder/read.json';
let dst_ = 'read.json';
let dst = fs.createWriteStream(dst_);

sftp.connect({
  host: 'localhost',
  username: 'ssh_server',
  password: 'admin'
}).then(() => {
  // create a file on SSH Server
  return sftp.put(data, remote_write);
}).then(() => {
  // Uploads the data in file at data_ to a new file on remote server at remote_write using concurrency.
  return sftp.fastPut(data_, remote_write);
}).then(() => {
  // get a file from SSH Server
  return sftp.get(remote_read, dst);
}).then(() => {
  // Downloads a file at remote_read to dst_ using parallel reads for faster throughput.
  return sftp.fastGet(remote_read, dst_);
}).then(() => {
  return sftp.end();
}).catch(err => {
  console.error(err.message);
});

// other functions:
// sftp.mkdir(directory_path, true);
// sftp.rmdir(directory_path, true);
// sftp.delete(file);
// sftp.rename(file);
// sftp.chmod(file, newMode);
