const express = require('express');
const app = express();
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const port = process.env.PORT || 3000;
const pool = require('./src/utils/pool');
const cors = require('cors')


app.use(bodyParser.json());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// property route here
const propertyRoutes = require('./src/routes/propertyRoutes');
app.use('/property' , propertyRoutes);

// for new property routes
const newPropertyRoutes = require('./src/routes/NewPropertyRoutes');
app.use('/new-property' , newPropertyRoutes);

app.listen(port , (err)=>{
    if(err){
        console.log(`error in port ${port}`);
        return;
    }
    console.log(`listening to port ${port}`);
    
});


// // create connection to mysql server
// const connection = mysql.createConnection({
//     host: '127.0.0.1',  //mysql server host
//     user: 'root', //mysql username
//     password: '373920' //mysql password
// });

// //connect to mysql server..
// connection.connect((err)=>{
//     if(err){
//         console.error('error connecting to mysql server' , err);
//         return
//     }
//     console.log('connected to mysql server');
    


// //create new db
// const dbName = 'bida_db';
// const createDBQuery = `CREATE DATABASE IF NOT EXISTS ${dbName}`;

// connection.query(createDBQuery , (err,result)=>{
//     if(err){
//         console.error('error creating db', err);
//         return;
//     }
//     console.log(`db ${dbName} connected successfully`);
    
// });

// connection.end((err)=>{
//     if(err){
//         console.error('error closing connection', err);
//         return;
//     }
//     console.log('connection closed');
    
// });

// });
