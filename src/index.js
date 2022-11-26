// const express = require("express");
// const app = express();
// const bodyParser = require('body-parser');
// const cors = require('cors');
// var fs = require('fs');



// app.use(cors());
// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: false }));

// function checkPassword(passowrd, hash)
// {
//     bcrypt.compare(passowrd, hash).then(function(result) {
//         return result;
//     });
// }



// function checkUser(username, password)
// {
//     // -1 user not found, 0 wrong password, 1 password fits username
//     if  (!(username in data["USERS"])) return -1;
//     if (checkPassword(password, data["USERS"][username])) return 1;
//     return 0;
// }
// console.log(data);

// app.post("/login", (request, response) => {
//     console.log("login");
// });
// app.get("/", (req, res) => {
//     res.send("<h1>Hello World</h1>");
// });


// app.listen(5000, () => {
//     console.log("server started on port 5000");
// });

const express = require('express');
const bodyParser = require('body-parser');
// const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const cors = require('cors');
const jwt = require('jsonwebtoken');
var fs = require('fs');
// const User = require('./models/User');

const saltRounds = 10
const password = "Admin@123"

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
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
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
    var status = checkUser(req.body.username, req.body.password, data["users"])
    console.log(status);
    if (status == -1) return res.status(401).json({
        title: 'invalid username or ',
        error: 'invalid credentials'
      })
      console.log("ok");
      let token = jwt.sign({ userId: req.body.username}, 'secretkey');
      return res.status(200).json({
        title: 'login sucess',
        token: token
      })


})

console.log("He")
app.post('/fileexplorer', (req, res, next) => {
  var current_path = path + req.body.directory;
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