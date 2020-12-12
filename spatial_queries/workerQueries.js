const pool = require("../pool.js");
const util = require("../utilities");
const { v4: uuidv4, uuid } = require("uuid");
const fs = require("fs");
const request = require("request");
const moment = require("moment");
const bcrypt = require("bcrypt");
const axios = require("axios");
const alert = require("alert");
const validator = require("validator");

const workerLogin = async (req, res) => {
  alert("Foo");
  let errors = [];
  const { username, password } = req.body;
  await pool.query(
    "SELECT * FROM bmc_worker WHERE phone_no = $1",
    [username],
    (error, results) => {
      if (error) throw error;
      else {
        if (results.rows.length == 0) {
          errors.push({
            message: "No such worker, please enter valid username",
          });
          console.log("NO MATCH");
          res.render("workerLogin", { errors });
        } else {
          flag = 0;
          let worker_id = "";
          for (var i = 0; i < results.rows.length; i++) {
            if (password === results.rows[i].password) {
              worker_id = results.rows[i].worker_id;
              flag = 1;
              break;
            }
          }
          if (flag == 1) {
            console.log("Matches");
            res.redirect(`/worker/upload/${worker_id}`);
          } else {
            errors.push({ message: "Incorrect password!" });
            res.render("workerLogin", { errors });
          }
        }
      }
    }
  );
};

//POST@ /worker/upload/:worker_id
const postWorkerResolvedForm = async (req, res) => {
  try {
    const worker_id = req.params.worker_id;
    const complaint_id = req.body.complaint_id;
    console.log("worker id isS");
    console.log(worker_id);
    let errors = [];
    // if (!req.body.images[0]) {
    //   errors.push({ message: "File not chosen" });
    //   res.render("uploadComplaintForm", { errors, user_id });
    // }
    if (!req.file) {
      errors.push({ message: "File not chosen, or incorrect format of file" });
      res.render("workerUpload", { errors, worker_id, color: "red" });
    } else if (req.errmessage) {
      errors.push({ message: req.errmessage });
      res.render("workerUpload", { errors, worker_id, color: "red" });
    } else {
      //get location from the photo
      console.log(req.file);
      const { filename, path } = req.file;

      let location = await util.getLocationFromPhoto(
        filename,
        "resolved_complaints"
      );
      console.log(location);

      const lat = location.lat;
      const long = location.lng;
      if (lat == 0) {
        //if location not found (GPS coordinates not present in image)

        errors.push({
          message:
            "Could not identify location of the picture. Make sure you have enabled your GPS and given permission to geocode your photos",
        });
        res.render("workerUpload", { errors, worker_id, color: "red" });
      } else {
        //*************************ML part***************************
        boolTrash = await util.detectTrash(
          `../public/resolved_complaints/${req.file.filename}`
        );
        //console.log("this is the type of ", typeof(boolTrash))
        const trashOrNot = boolTrash.trim().charAt(boolTrash.trim().length - 1);

        if (trashOrNot === "1") {
          errors.push({ message: "Trash detected!" });
          res.render("workerUpload", { errors, worker_id, color: "red" });
        }
        console.log(lat);
        console.log(long);
        const complaint_id = req.body.complaint_id;
        //check if the complaint ID is in the valid uuid form or not
        if (!validator.isUUID(complaint_id)) {
          errors.push({
            message: "Invalid complaint ID",
          });
          res.render("workerUpload", { errors, worker_id, color: "red" });
        } else {
          //query from both active_complaints and resolved_complaints table to find if the complaint is resolved or not
          const result1 = await pool.query(
            "SELECT * FROM active_complaints where complaint_id=$1",
            [complaint_id]
          );
          const result2 = await pool.query(
            "SELECT * FROM resolved_complaints WHERE complaint_id=$1",
            [complaint_id]
          );
          if (result1.rows.length === 0 && result2.rows.length === 0) {
            errors.push({
              message: "This complaint ID does not exist",
            });
            res.render("workerUpload", { errors, worker_id, color: "red" });
          } else if (result1.rows.length === 0) {
            errors.push({
              message: "This complaint has already been resolved",
            });
            res.render("workerUpload", { errors, worker_id, color: "red" });
          } else {
            // if the complaintID is correct, check if the image taken
            // is within a particular distance of that active complaint
            console.log("correct complaint ID");
            console.log(lat);
            console.log(long);

            const lat_of_resolved = lat;
            const long_of_resolved = long;
            const result3 = await pool.query(
              "SELECT ST_Distance(ST_MakePoint($2, $3), geolocation) as distance FROM active_complaints WHERE complaint_id=$1 AND ST_Distance(ST_MakePoint($2, $3), geolocation)<50",
              [complaint_id, long_of_resolved, lat_of_resolved]
            );
            //if the resolved pic is not within that location
            if (result3.rows.length === 0) {
              errors.push({
                message:
                  "You are not within the location of the complaint lodged, upload image again",
              });
              res.render("workerUpload", { errors, worker_id, color: "red" });
            }
            //if it is within a particular range
            else {
              //remove from the active complaints table and put into the resolved complaints table
              const result4 = await pool.query(
                "SELECT * FROM active_complaints WHERE complaint_id=$1 ",
                [complaint_id]
              );
              console.log("here");
              console.log(complaint_id);
              console.log(result4.rows);
              const res1 = await pool.query(
                "DELETE FROM active_complaints WHERE complaint_id=$1 ",
                [complaint_id]
              );

              //calculate current date and time
              const today = new Date();
              const currentMonth =
                today.getMonth() < 10
                  ? "0" + today.getMonth()
                  : "" + today.getMonth();
              console.log(currentMonth);
              const currentDate =
                today.getFullYear() + "" + currentMonth + "" + today.getDate();
              var currentTime = moment().format("HHmmss");

              const complaint = result4.rows[0];

              const res2 = await pool.query(
                "INSERT INTO resolved_complaints (complaint_id, user_id, ward_id, image, worker_id, date, time, resolved_image, status, complaint_address ) VALUES ($1, $2, $3, $4, $5, TO_DATE($6, $7),TO_TIMESTAMP($8, $9), $10, $11, $12)",
                [
                  complaint_id,
                  complaint.user_id,
                  complaint.ward_id,
                  complaint.image,
                  worker_id,
                  currentDate,
                  "YYYYMMDD",
                  currentTime,
                  "HH24MIss",
                  req.file.path,
                  "NR",
                  complaint.complaint_address,
                ]
              );

              console.log("within correct distance");
              // res.redirect(`/worker/upload/${worker_id}`);

              errors.push({
                message: "Complaint resolved successfully",
              });
              res.render("workerUpload", { errors, worker_id, color: "green" });
            }
          }
        }
      }
    }
  } catch (err) {
    throw err;
    res.send(err);
  }
};

module.exports = { workerLogin, postWorkerResolvedForm };

// const complaint_id = req.body.complaint_id;
// const lat_of_resolved = lat;
// const long_of_resolved = long;
// const result = await pool.query(
//   "SELECT * FROM active_complaints WHERE complaint_id=$1 AND ST_Distance(ST_MakePoint($2, $3), geolocation)<50"
// );
// //if the resolved pic is not within that location
// if (result.rows.length === 0) {
//   error.push({
//     message:
//       "You are not within the location of the complaint lodged, upload image again",
//   });
//   res.render("workerUpload", { errors, worker_id, color: "red" });
// }
// //else redirect with success message
// else{
//   res.redirect()
// }

//********** */

// console.log(lat);
// console.log(long);
// res.redirect(`/worker/upload/${worker_id}`);
