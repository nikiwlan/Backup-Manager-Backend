const express = require('express');
const bcrypt = require('bcrypt');
const cors = require('cors');
const jwt = require('jsonwebtoken');
var fs = require('fs');
const formidable = require('express-formidable');
const AdmZip = require("adm-zip");
const saltRounds = 10
const password = "Admin@123"
var zipfile_num = 0;
const app = express();
app.use(cors());
app.use(formidable());
var data = JSON.parse(fs.readFileSync( "./data.json", {encoding:'utf8', flag:'r'}))
console.log(data)
function checkPassword(passowrd_to_check, hash)
{
    return bcrypt.compareSync(passowrd_to_check, hash);
}
function checkUser(username, password, users)
{
    // -1 user not found, 0 wrong password, 1 password fits username
    if  (!(username in users)) return -1;
    console.log(password, users[username])
    if (checkPassword(password, users[username])) return 1;
    return -1;
}

app.post('/login', (req, res, next) => {
  var status = checkUser(req.fields.username, req.fields.password, data["users"])
  console.log(status);
  if (status == -1) return res.status(401).json({
      title: 'invalid username or ',
      error: 'invalid credentials'
    })
    console.log("ok");
    let token = jwt.sign({ userId: req.fields.username}, 'secretkey');
    return res.status(200).json({
      title: 'login sucess',
      token: token
    })
})

const port = process.env.PORT || 5000;

app.listen(port, (err) => {
  if (err) return console.log(err);
  console.log('server running on port ' + port);
})

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////

const { readFileSync } = require('fs');
const { Client } = require('ssh2');
const conn = new Client();
let sftpClient = require('ssh2-sftp-client');
let sftp = new sftpClient();
var ssh_config = {
  host: 'localhost',
  username: 'ssh_server',
  password: 'admin'
};

//const path = "C:/Users/ssh_server/test_backup";
const path = "test_backup";

app.post('/fileexplorer', (req, res, next) => {
  var current_path = path + "/" + req.fields.directory;
  var file_list = [];

  sftp.connect(ssh_config)
  .then(() => {
    return sftp.list(current_path);
  })
  .then(data => {
    data.forEach((dir) => {
      if (dir.type === "d") {
        file_list.push({
          name: dir.name,
          directory: true
        });
      } else {
        file_list.push({
          name: dir.name,
          directory: false
        });
      }
    });
    res.status(200).send(file_list);
  })
  .then(() => {
    sftp.end();
  })
  .catch(err => {
    console.error(err.message);
    sftp.end();
  });
});


app.post("/upload",(req, res, next) => {
    // TODO
    console.log("/upload");

    /*
  for (const [key, value] of Object.entries(req.files)){
    
    var rawData = fs.readFileSync(value.path)
    var new_path = path + req.fields.destination  + value.name;

    console.log(rawData);
    console.log(new_path);

    sftp.connect(ssh_config).then(() => {
      // Uploads the data in file at data_ to a new file on remote server at remote_write using concurrency.
      return sftp.fastPut(rawData, new_path);
    }).then(() => {
      res.status(200).send("OK");
      return sftp.end();
    }).catch(err => {
      console.error(err.message);
    });
  }*/
});


app.get("/download",(req, res, next) => {
  zipfile_num += 1;
  const filepath = path + "/" + req.query["file_name"];
  console.log(filepath);

  conn.on('ready', () => {
    conn.shell((err, stream) => {
      if (err) throw err;
      stream.on('close', () => {
        conn.end();
      }).on('data', (data) => {
        // console.log(data);
      });
      sftp.connect(ssh_config).then(() => {
        stream.end('powershell Compress-Archive ' + filepath + ' ' + filepath + '.zip\r');
      }).then(() => {
        // Downloads a file at remote_read to dst_ using parallel reads for faster throughput.
        return sftp.fastGet(filepath + ".zip", "C:/Users/erikc/" + filepath + ".zip");
      }).then(() => {
        return sftp.end();
      }).catch(err => {
        console.error(err.message);
      });
    });
  }).on("error", (err) => {
    console.log(err.stack);
    conn.end();
  }).connect(ssh_config);
  
});


app.post("/remove_file",(req, res, next) => {
    // TODO
    const test_path = "test_backup/test.txt";
    console.log("/remove_file --> " + test_path);

    sftp.connect(ssh_config)
      .then(() => {
        return sftp.delete(test_path);
      })
      .then(() => {
        res.status(200).send("OK");
        sftp.end();
      })
      .catch(err => {
        console.error(err.message);
        sftp.end();
        return res.status(401).json({
          title: "failed ",
          error: "failed",
        });
      });
    });


app.post("/move_file",(req, res, next) => {
   // TODO
   const test_path_from = "test_backup/test.txt";
   const test_path_to = "test_backup/hey/test.txt";

   console.log("/move_file --> " + req);

   sftp.connect(ssh_config)
   .then(() => {
     return sftp.rename(test_path_from, test_path_to);
   })
   .then(() => {
     res.status(200).send("OK");
     sftp.end();
   })
   .catch(err => {
     console.error(err.message);
     sftp.end();
     return res.status(401).json({
       title: "failed ",
       error: "failed",
     });
   });
});

