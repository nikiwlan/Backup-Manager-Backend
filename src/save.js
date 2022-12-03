

const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const cors = require('cors');
const jwt = require('jsonwebtoken');
var fs = require('fs');
const formidable = require('express-formidable');

const saltRounds = 10
const password = "Admin@123"

function createPassword(passowrd_to_hash)
{
    return bcrypt.hashSync(passowrd_to_hash, 5);
}

const path_use = "D:/test_backup";

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
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
var data = JSON.parse(fs.readFileSync( "./data.json", {encoding:'utf8', flag:'r'}))

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
    var status = checkUser(req.body.username, req.body.password, data["users"])
    if (status == -1) return res.status(401).json({
        title: 'invalid username or ',
        error: 'invalid credentials'
      })
      let token = jwt.sign({ userId: req.body.username}, 'secretkey');
      return res.status(200).json({
        title: 'login sucess',
        token: token
      })


})

app.post('/fileexplorer', (req, res, next) => {
  var current_path = path_use + req.body.directory;
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


app.route('/upload')
    .post(function (req, res, next) {
      
      console.log("Hey");

        // var fstream;
        // req.pipe(req.busboy);
        // req.busboy.on('file', function (fieldname, file, filename) {
        //     console.log("Uploading: " + filename);

        //     //Path where image will be uploaded
        //     fstream = fs.createWriteStream(__dirname + '/img/' + filename);
        //     file.pipe(fstream);
        //     fstream.on('close', function () {    
        //         console.log("Upload Finished of " + filename);              
        //         res.redirect('back');           //where to go next
        //     });
        // });
    });

    // app.post('/upload',
    // // fileUpload({ createParentPath: true }),
    // // filesPayloadExists,
    // // fileExtLimiter(['.png', '.jpg', '.jpeg']),
    // // fileSizeLimiter,
    // (req, res) => {
    //     // const files = req.files
    //     // console.log(files)

    //     // Object.keys(files).forEach(key => {
    //     //     const filepath = path.join(path_use, 'files', files[key].name)
    //     //     files[key].mv(filepath, (err) => {
    //     //         if (err) return res.status(500).json({ status: "error", message: err })
    //     //     })
    //     // })

    //     // return res.json({ status: 'success', message: Object.keys(files).toString() })
    // }
// )