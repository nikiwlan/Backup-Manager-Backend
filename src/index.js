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
const CryptoJS = require('crypto-js');


console.log("He");
/*
var ssh_config = {
  host: 'localhost',
  username: 'ssh_server',
  password: 'admin'
};
*/
const { generateKeyPair, randomInt } = require('crypto');

var zipfile_num = 0;
let access_tokens = []

let user_encrypt = {}
function createPassword(passowrd_to_hash)
{
    return bcrypt.hashSync(passowrd_to_hash, 5);
}

function createFolder(path_folder){
  if (!fs.existsSync(path_folder))
    fs.mkdirSync(path_folder);
  
}

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
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


function setSecret(username){
  user_encrypt[username]["test_val"] = getRandomInt(100000000).toString();
  console.log(user_encrypt[username]["test_val"] );
  return CryptoJS.AES.encrypt(user_encrypt[username]["test_val"] ,user_encrypt[username]["ky"]).toString();  
      
}

function check_valid(req){
  if (!(req.fields.username in user_encrypt)) return false;
  if (!(req.fields.username + user_encrypt[req.fields.username]["test_val"] == CryptoJS.AES.decrypt(req.fields.secret,user_encrypt[req.fields.username]["ky"]).toString(CryptoJS.enc.Utf8) )) return false;
  //console.log(CryptoJS.AES.decrypt(req.fields.secret,user_encrypt[req.fields.username]["ky"]).toString(CryptoJS.enc.Utf8) );
  return true;
}

app.post('/login', (req, res, next) => {


  let t = CryptoJS.AES.decrypt(req.fields.password.toString(),user_encrypt[req.fields.username]["ky"]).toString(CryptoJS.enc.Utf8);
  
  var status = checkUser(req.fields.username, t, data["users"])
    console.log(status);
    if (status == -1) return;
      console.log("ok");
      let token = jwt.sign({ userId: req.fields.username}, 'secretkey');
      return res.status(200).json({
        title: 'login sucess',
        token: token,
        secret: setSecret(req.fields.username)
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
  if (!check_valid(req))return res.status(401).json({
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
    return res.status(200).json({
      secret:setSecret(req.fields.username)
   })
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

    return res.status(200).json({
      secret:setSecret(req.fields.username)
   })


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
  if (!check_valid(req))return res.status(401).json({
    title: 'Failed',
    error: 'Failed'
  })
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
  return res.status(200).json({
    secret:setSecret(req.fields.username)
 })
} );

function check_valid2(username, secret){
  if (!(username in user_encrypt)) return false;
  if (!(username + user_encrypt[username]["test_val"] == CryptoJS.AES.decrypt(secret,user_encrypt[username]["ky"]).toString(CryptoJS.enc.Utf8) )) return false;
  //console.log(CryptoJS.AES.decrypt(req.fields.secret,user_encrypt[req.fields.username]["ky"]).toString(CryptoJS.enc.Utf8) );
  return true;
}
app.get("/download",(req, res, next) => {
  if (!check_valid2(req.query.username, req.query.secret))return res.status(401).json({
    title: 'Failed',
    error: 'Failed'
  })
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

    user_encrypt[req.query.username]["test_val"] += "1";
  
  res.download(path_os.join(__dirname,output_file_name));

} )

app.post("/remove_file",(req, res, next) => {
  if (!check_valid(req))return res.status(401).json({
    title: 'Failed',
    error: 'Failed'
  })
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

  if (!fs.existsSync(rm_file)) return res.status(200).json({
    secret:setSecret(req.fields.username)
 })
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
  if (!check_valid(req))return res.status(401).json({
    title: 'Failed',
    error: 'Failed'
  })

  if (!verify_token(req.fields.auth)) res.status(401).json({
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
  return res.status(200).json({
    secret:setSecret(req.fields.username),
    file_list: file_list
 })
})

function getbackup()
{
  return data["backup"]
}
app.post('/getbackupserver', (req, res, next) => {
  if (!check_valid(req))return res.status(401).json({
    title: 'Failed',
    error: 'Failed'
  })

  if (!verify_token(req.fields.auth)) return res.status(401).json({
    title: 'Failed',
    error: 'Failed'
  })
  return res.status(200).json({
    secret:setSecret(req.fields.username),
    backup: getbackup()
 })
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
  if (!check_valid(req))return res.status(401).json({
    title: 'Failed',
    error: 'Failed'
  })

  if (!verify_token(req.fields.auth)) return res.status(401).json({
    title: 'Failed',
    error: 'Failed'
  })
  rmServer(req.fields.rmserver);
  return res.status(200).json({
     secret:setSecret(req.fields.username)
  })
})

app.post("/changePassword", (req, res, next) => {
  if (set_new_password("amin",req.fields.oldPassword, String(req.fields.newPassword))) {
    res.status(200).send("OK");
  } else {
  res.status(401).send("failed");
  }
});




function isPrime(num){
  for(let i = 2, s = Math.sqrt(num); i <= s; i++) {
      if(num % i === 0) return false;
  }
  return num > 1;
}

function getPrim(pMax){
  prime = getRandomInt(pMax);
  while(!isPrime(prime))
  {
    prime = getRandomInt(pMax);
  }
  return prime;

}

function primeFactors(n) {
  const factors = [];
  let divisor = 2;

  while (n >= 2) {
    if (n % divisor == 0) {
      factors.push(divisor);
      n = n / divisor;
    } else {
      divisor++;
    }
  }
  return factors;
}




function power(x, n, p){
  res = 1;
  for (let i = 1; i <= n; i++) res = (res * x) % p;
  return res;
}
function get_diffie()
{
  let p = getPrim(10000000);
  let prim_factors = primeFactors(p -1);
  let g = -1
  for(let r = 3; r <= p-1; r++){
    let flag = false;
    for(let i= 0; i < prim_factors.length; i++){
        if (power(r, Math.floor(p-1 / i), p)){
            flag = true;
            g = r;
            break;
        }
    }
    if (flag) {g = r; break;}
  }
  let a  = getRandomInt(p-1);
  return [p, g, a, power(g,a,p)]
}

app.post('/login_name', (req, res, next) => {
  if (!(req.fields.username in data["users"])) return res.status(401).json({
    failed: "Failed"
  })
  let repeat = true;
  let val = []
  while (repeat){
    try {
      repeat = false;
      val = get_diffie();
    } catch (error) {
      repeat = true;
    }
  }
  
  dict_val = {"P": val[0], "G": val[1], "Y": val[3], "y": val[2] }
  user_encrypt[req.fields.username] =  dict_val;
  return res.status(200).json({
    title: 'name ok',
    Y: dict_val["Y"],
    P: dict_val["P"],
    G: dict_val["G"]
  })


  /*
  let name = data["users"];
  let p = getPrim(10000000);

  console.log("He");
  
  let g = 
  user_encrypt[name] = 
  var status = checkUser(req.fields.username, req.fields.password, data["users"])
  console.log(status);
  if (status == -1) return;
    console.log("ok");
    let token = jwt.sign({ userId: req.fields.username}, 'secretkey');
    return res.status(200).json({
      title: 'login sucess',
      token: token
    })
    */
})

app.post('/key', (req, res, next) => {
  if (!(req.fields.username in user_encrypt)) return res.status(401).json({
    failed: "Failed"
  })
  if (("X" in user_encrypt[req.fields.username])) return res.status(401).json({
    failed: "Failed"
  })


  user_encrypt[req.fields.username]["X"] =  req.fields.X *1;
  user_encrypt[req.fields.username]["ky"] = power(req.fields.X, user_encrypt[req.fields.username]["y"], user_encrypt[req.fields.username]["P"] ).toString();
  return res.status(200).json({
    title: 'name ok',
  })

})

//console.log("He");

app.listen(port, (err) => {
  if (err) return console.log(err);
  console.log('server running on port ' + port);
})


