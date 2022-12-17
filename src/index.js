const express = require('express');
const bcrypt = require('bcrypt');
const cors = require('cors');
const jwt = require('jsonwebtoken');
var fs = require('fs');
const formidable = require('express-formidable');
const AdmZip = require("adm-zip");
const saltRounds = 10
const password = "Admin@123"
const path_os = require('node:path')
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


const app = express();
app.use(cors());
app.use(formidable());
var data = JSON.parse(fs.readFileSync(path_os.join(__dirname, "Data", "Save", "data.json") , {encoding:'utf8', flag:'r'}))
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
function createPath(original_path, path_list){

  var current_path= original_path;


    path_list.forEach((item) => {
      current_path = path_os.join(current_path, item)
    } )
    return current_path;

}
app.post('/fileexplorer', (req, res, next) => {

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

const port = process.env.PORT || 5000;

app.listen(port, (err) => {
  if (err) return console.log(err);
  console.log('server running on port ' + port);
})

app.post("/upload",(req, res, next) => {

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


// app.post('/mkdir', (req, res, next) => {
//   var current_path = path + req.fields.directory;
//   console.log(current_path);
//   if (!fs.existsSync(current_path))
//   {
//     console.log("failed Dir")
//     return res.status(401).json({
//           title: 'path does not exist ',
//           error: 'invalid credentials'
//         })
//   }
//   var file_list = getDirectories(current_path);
//   res.status(200).send(file_list);
// })
// app.post("/move_file",(req, res, next) => {
//  var source_file = path + req.fields.path_to_move;
//  var dest_dir = path + req.fields.dest_dir;
//  fs.renameSync(source_file, dest_dir, function (err) {
//   if (err) return res.status(401).json({
//     title: 'failed ',
//     error: 'failed'
//   })
// })
// res.status(200).send("OK");
// } )

