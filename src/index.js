const express = require('express');
const bcrypt = require('bcrypt');
const cors = require('cors');
const jwt = require('jsonwebtoken');
var fs = require('fs');
const formidable = require('express-formidable');
const AdmZip = require("adm-zip");
const saltRounds = 10
const password = "Admin@123"
const path_os = require('path');
let sftpClient = require('ssh2-sftp-client');
const { exec } = require("child_process");
const schedule = require('node-schedule');
/*
var ssh_config = {
  host: 'localhost',
  username: 'ssh_server',
  password: 'admin'
};
*/
const { generateKeyPair } = require('crypto');
var zipfile_num = 0;
let access_tokens = []
function createPassword(passowrd_to_hash)
{
    return bcrypt.hashSync(passowrd_to_hash, 5);
}

function createFolder(path_folder){
  if (!fs.existsSync(path_folder))
    fs.mkdirSync(path_folder);
  
}


const corsOptions = {origin: ["http://192.168.0.107:8080", "http://localhost:8080"], optionsSuccessStatus: 200}


const path_backup = path_os.join(__dirname, "Data", "Backup");
createFolder(path_backup);
const path_ssh_folder = path_os.join(__dirname, "Data", "SSH");
createFolder(path_ssh_folder);
const path_prepare_folder = path_os.join(__dirname, "Data", "Prepare");
createFolder(path_prepare_folder);

// console.log(path_os.join(__dirname, "src"));
function getDirectories(current_path)
{
  var file_list = fs.readdirSync(current_path, { withFileTypes: true });
  var return_file_list = []
  file_list.forEach(function(x,i) {
    if (x.isDirectory())return_file_list.push({name: x["name"], directory: x.isDirectory()})
  } ) 
  file_list.forEach(function(x,i) {
    if (!x.isDirectory())return_file_list.push({name: x["name"], directory: x.isDirectory()})
  } ) 
  return return_file_list;
}

function rsyncAll()
{
  for (var server of data["backup"] ){
    var cmd = "rsync -avxP --delete \'ssh -i " + path_os.join(path_ssh_folder, "id_rsa" ) + "\' " + path_backup + " " +server["username"] +"@" + server["serverAddress"] + ":" + server["path"]
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
          console.log(`error: ${error.message}`);
          return;
      }
      if (stderr) {
          console.log(`stderr: ${stderr}`);
          return;
      }
      console.log(`stdout: ${stdout}`);
  });
  }
  

}



var data_path = path_os.join(__dirname, "Data", "Save", "data.json") 
const app = express();
app.use(cors(corsOptions));
app.use(formidable());
var data = JSON.parse(fs.readFileSync(data_path, {encoding:'utf8', flag:'r'}))
console.log(data)
rsyncAll()
schedule.scheduleJob('38 * * * *', () => { rsyncAll()})
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
    if (status == -1) return;
      console.log("ok");
      let token = jwt.sign({ userId: req.fields.username}, 'secretkey');
      return res.status(200).json({
        title: 'login sucess',
        token: token
      })


})


function addBackupServerToDataFile(serverAddress, username, path) {

  if ((serverAddress != "", username != "", path != "")) {
  //TODO später prüfen ob korrekte Eingaben ob server existiert ?
  
 if ("backup" in data){

 }
 else data["backup"]= []
 check = false
 for (var server of data["backup"] ){
     if (server["serverAddress"] === serverAddress) check = true}
  if (check) return

  data["backup"].push({
    "serverAddress": serverAddress,
    "username": username,
    "path": path
    })

    fs.writeFile(data_path, JSON.stringify(data), function (err) {
      if (err) {
      console.log(err);
      return 0;
      }
      });
  }}

app.post('/sshcheck', (req, res, next) => {
  if (!verify_token(req.fields.auth)) return res.status(401).json({
    title: 'Failed',
    error: 'Failed'
  })
  let sftp = new sftpClient();
  var ssh_config = {
    host: req.fields.host,
    username: req.fields.username,
    privateKey: fs.readFileSync(path_os.join(path_ssh_folder, "id_rsa" ))
  };


  sftp.connect(ssh_config)
  .then(() => {
    return sftp.list(req.fields.path);
  })
  .then(res_data => {
    console.log(res_data);
    addBackupServerToDataFile(req.fields.host, req.fields.username, req.fields.path);
  })
  .then(() => {
    sftp.end();
    res.status(200).send("Ok");
  })
  .catch(err => {
    console.error(err.message);
    sftp.end();
    res.status(401).json({
      title: 'Failed',
      error: 'Failed'
    });
  });
  
});

app.post('/mkdir', (req, res, next) => {

  if (!verify_token(req.fields.auth)) return res.status(401).json({
    title: 'Failed',
    error: 'Failed'
  })
  var val = []
  if (req.fields.directory) val =  req.fields.directory.split(",");
  if (check_path(val)) return res.status(401).json({
    title: 'Failed',
    error: 'Failed'
  })
  current_path = createPath(path_backup, val )
  fs.mkdir(path_os.join(current_path, req.fields.dirname), (err) => {
    if (err) {
      res.status(401).json({
        title: 'Failed',
        error: 'Failed'
      });
    }}
    )

    res.status(200).send("OK");


})

function verify_token(auth){
  try{
    return jwt.verify( auth, 'secretkey')["userId"] in data["users"];
  }
  catch(error)
  {
    return false;
  }
}

function return_failed(res)
{
  return res.status(401).json({
    title: 'Failed',
    error: 'Failed'
  })

}

function check_path(path_list)
{
  path_list.forEach((item) => {
    if (item.includes("..") ) return true;
    if (item.includes(".") ) return true;
    if (item.includes(":") ) return true;
  } )
  return false;
}

// sertzt den Pfad zusammen.
function createPath(original_path, path_list){

  var current_path= original_path;

  // hinzufügen der Pfade aus der path_list um den Pfad zu bilden.
  path_list.forEach((item) => {
      current_path = path_os.join(current_path, item)
   } )
  // senden des Pfads
  return current_path;
}



const port = process.env.PORT || 5000;

app.post("/upload",(req, res, next) => {
  // Token verifizieren
  if (!verify_token(req.fields.auth)) return res.status(401).json({
    title: 'Failed',
    error: 'Failed'
  })

  // Pfad überprüfen
  var val = []
  if (req.fields.directory) val =  req.fields.directory.split(",");
  if (check_path(val)) return res.status(401).json({
    title: 'Failed',
    error: 'Failed'
  })
  current_path = createPath(path_backup, val )

  // speichern der gesendeten Dateien.
  for (const [key, value] of Object.entries(req.files)){
    
    var rawData = fs.readFileSync(value.path)
    var new_path = path_os.join(current_path ,value.name) ;
    console.log(new_path);
    fs.writeFile(new_path, rawData, function(err){
      if(err) {return res.status(401).json({
        title: 'Failed to upload '
      }); return;}
      
  })
  }
  res.status(200).send("OK");
} );

app.get("/download",(req, res, next) => {
  if (!verify_token(req.query.auth)) return res.status(401).json({
    title: 'Failed',
    error: 'Failed'
  })
  zipfile_num += 1;
  var val = []
  if (req.query.directory){ val =  req.query.directory.split(",");
  if (check_path(val)) return res.status(401).json({
    title: 'Failed',
    error: 'Failed'
  })}
  current_path = createPath(path_backup, val )
  filepath = path_os.join(current_path ,req.query.file_name) ;
  if (!fs.existsSync(filepath)) return res.status(401).json({
    title: 'Failed',
    error: 'Failed'
  })
  // const filepath = path + req.query["file_path"] ;
  
  output_file_name = "target" + zipfile_num + ".zip";
  const zip = new AdmZip();
  if (fs.lstatSync(filepath).isDirectory()){
    zip.addLocalFolder(filepath);
  }
  else {
    zip.addLocalFile(filepath);  }
  
    zip.writeZip(path_os.join(__dirname,output_file_name));


  res.download(path_os.join(__dirname,output_file_name));

} )

app.post("/remove_file",(req, res, next) => {
  // rm_file = path +req.fields.path_to_delete;
  if (!verify_token(req.fields.auth)) return res.status(401).json({
    title: 'Failed',
    error: 'Failed'
  })
  var val = []
  if (req.fields.directory) val =  req.fields.directory.split(",");
  if (check_path(val)) return res.status(401).json({
    title: 'Failed',
    error: 'Failed'
  })
  current_path = createPath(path_backup, val )
  rm_file = path_os.join(current_path ,req.fields.delete_file) ;
  if (fs.existsSync(rm_file)) fs.unlinkSync(rm_file);
  else  return res.status(401).json({
    title: 'failed ',
    error: 'failed'
  })

  if (!fs.existsSync(rm_file)) res.status(200).send("OK");
  else return res.status(401).json({
    title: 'failed ',
    error: 'failed'
  })
} )

function set_new_password(username, password, new_password) {
  if (checkUser(username, password, data["users"])) {
  data["users"][username] = createPassword(new_password);
  fs.writeFile("./data.json", JSON.stringify(data), function (err) {
  if (err) {
  console.log(err);
  return 0;
  }
  });
  return 1;
  }
  return 0;
  }
  


app.post('/fileexplorer', (req, res, next) => {

  if (!verify_token(req.fields.auth)) return ;res.status(401).json({
    title: 'Failed',
    error: 'Failed'
  })
  var val = []
  if (req.fields.directory) val =  req.fields.directory.split(",");
  if (check_path(val)) return res.status(401).json({
    title: 'Failed',
    error: 'Failed'
  })
  current_path = createPath(path_backup, val )
  
  console.log(current_path);
  if (!fs.existsSync(current_path))
  {
    console.log("failed Dir")
    return  res.status(401).json({
      title: 'Failed',
      error: 'Failed'
    })
  }
  var file_list = getDirectories(current_path);
  res.status(200).send(file_list);
})

function getbackup()
{
  return data["backup"]
}
app.post('/getbackupserver', (req, res, next) => {

  if (!verify_token(req.fields.auth)) return res.status(401).json({
    title: 'Failed',
    error: 'Failed'
  })
  res.status(200).send(getbackup())
})

function rmServer(serverAddress) {

  if (serverAddress != "") {

 if ("backup" in data){

 }
 else data["backup"]= []


new_data = []
 for (var i = 0; i < data["backup"].length; i++) { if (data["backup"][i]["serverAddress"] != serverAddress)  new_data.push(data["backup"][i])}
data["backup"] = new_data;

fs.writeFile(data_path, JSON.stringify(data), function (err) {
      if (err) {
      console.log(err);
      return 0;
      }
      });
  }}

app.post('/removeserver', (req, res, next) => {

  if (!verify_token(req.fields.auth)) return res.status(401).json({
    title: 'Failed',
    error: 'Failed'
  })
  rmServer(req.fields.rmserver);
  res.status(200).send("Ok")
})

app.post("/changePassword", (req, res, next) => {
  if (set_new_password("amin",req.fields.oldPassword, String(req.fields.newPassword))) {
    res.status(200).send("OK");
  } else {
  res.status(401).send("failed");
  }
});



app.listen(port, (err) => {
  if (err) return console.log(err);
  console.log('server running on port ' + port);
})
