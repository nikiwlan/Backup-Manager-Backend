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

function createPassword(passowrd_to_hash)
{
    return bcrypt.hashSync(passowrd_to_hash, 5);
}

const path = "D:/test_backup";

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

console.log("He")
app.post('/fileexplorer', (req, res, next) => {
  var current_path = path + req.fields.directory;
  console.log(current_path);
  if (!fs.existsSync(current_path))
  {
    console.log("failed Dir")
    return res.status(401).json({
          title: 'path does not exist ',
          error: 'invalid credentials'
        })
  }
  var file_list = getDirectories(current_path);
  res.status(200).send(file_list);
})

const port = process.env.PORT || 5000;

app.listen(port, (err) => {
  if (err) return console.log(err);
  console.log('server running on port ' + port);
})

app.post("/upload",(req, res, next) => {

  for (const [key, value] of Object.entries(req.files)){
    
    var rawData = fs.readFileSync(value.path)
    var new_path = path + req.fields.destination  +value.name;
    fs.writeFile(new_path, rawData, function(err){
      if(err) {return res.status(401).json({
        title: 'Failed to upload '
      }); return;}
      
  })
  }
  res.status(200).send("OK");
} );

app.get("/download",(req, res, next) => {
  zipfile_num += 1;
  const filepath = path + req.query["file_path"] ;
  
  output_file_name = "/target" + zipfile_num + ".zip";
  const zip = new AdmZip();
  if (fs.lstatSync(path + req.query["file_path"]).isDirectory()){
    zip.addLocalFolder(filepath);
  }
  else {
    zip.addLocalFile(filepath);  }
  
    zip.writeZip(__dirname +output_file_name);


  res.download(__dirname +output_file_name);

} )
