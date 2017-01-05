"use strict";

var express = require("express");
var path = require("path");
var bodyParser = require("body-parser");
var mongodb = require("mongodb");
var ObjectID = mongodb.ObjectID;

var MEASUREMENTS_COLLECTION = "measurements";

var app = express();
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.json());

// Create a database variable outside of the database connection callback to reuse the connection pool in your app.
var db;

var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/beun"



/*
ALLOW CROSS ORIGIN FOR BEUNHAAS
*/
app.use(function (req, res, next) {
  console.log(req.method, req.ip, req.path);
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET,POST");
  next();
});



// Connect to the database before starting the application server.
mongodb.MongoClient.connect(MONGODB_URI, function (err, database) {
  if (err) {
    console.log(err);
    process.exit(1);
  }

  // Save database object from the callback for reuse.
  db = database;
  console.log("Database connection ready");

  // Initialize the app.
  var server = app.listen(process.env.PORT || 8080, function () {
    var port = server.address().port;
    console.log("App now running on port", port);
  });
});


// Generic error handler used by all endpoints.
function handleError(res, reason, message, code) {
  console.log("ERROR: " + reason);
  res.status(code || 500).json({ "error": message });
}


/*  "/measurements"
 *    GET: finds all measurements (max 100)
 *    POST: creates a new measurements
 */

const MEASUREMENTS_URL = "/measurements";
const MEASUREMENTS_GRAPH_URL = MEASUREMENTS_URL + "/graph";

app.get(MEASUREMENTS_URL, function (req, res) {
  db.collection(MEASUREMENTS_COLLECTION).find({}).limit(100).toArray(function (err, docs) {
    if (err) {
      handleError(res, err.message, "Failed to get measurements.");
    } else {
      res.status(200).json(docs);
    }
  });
});

/**
 * Helper function to transform all values of sensors to x.yy (two decimals, duh)
 */
var twoDecimals = function (number) {
  return Math.round(number * 100) / 100;
};

app.get(MEASUREMENTS_GRAPH_URL, function (req, res) {
  db.collection(MEASUREMENTS_COLLECTION).find({}).limit(1000).toArray(function (err, docs) {
    if (err) {
      handleError(res, err.message, "Failed to get measurements.");
    } else {

      var select = function (data, name) { 

        var values = data.map(function (value, index) {
          return {
            x: index,
            y: twoDecimals(value.sensors.find(function (value, index) { return value.name === name; }).value)
          }
        });

        return {
          label: name,
          data: values
        };
      };

      res.status(200).json(
        {
          datasets: [
            select(docs, 'temp-1'), 
            select(docs, 'temp-2'), 
            select(docs, 'temp-3'), 
            select(docs, 'temp-4')
            ]
          }
          );
    }
  });
});

app.post(MEASUREMENTS_URL, function (req, res) {
  console.log("New Measurement", req.body, new Date());
  var newMeasurement = req.body;
  newMeasurement.createDate = new Date();

  db.collection(MEASUREMENTS_COLLECTION).insertOne(newMeasurement, function (err, doc) {
    if (err) {
      handleError(res, err.message, "Failed to create new contact.");
    } else {
      res.status(201).json(doc.ops[0]);
    }
  });
});
