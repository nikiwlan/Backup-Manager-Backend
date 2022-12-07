// https://github.com/mscdex/ssh2

const { readFileSync } = require('fs');
const { Client } = require('ssh2');
const conn = new Client();

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