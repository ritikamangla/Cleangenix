const pool = require("../pool.js");
const util = require("../utilities");
const { v4: uuidv4, uuid } = require("uuid");
const fs = require("fs");
const request = require("request");
const moment = require("moment");
const bcrypt = require("bcrypt");
const axios = require("axios");
const alert = require("alert");

const gdQueries = require("../graph_queries/userQueries");
const complaintQueries = require("../graph_queries/complaintQueries");

const userRegister = async (req, res) => {
  try {
    let errors = [];
    const { phone_no, pincode, password, repassword } = req.body;
    if (repassword != password) {
      res.json({ msg: "Passwords do not match" });
    }
    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    //Find out the lat and long of the user from the pincode using the locationIQ API
    const config = {
      method: "get",
      url: `https://us1.locationiq.com/v1/search.php?key=pk.9e8187ff3784e0e5cfef0fe6733bfd25&postalcode=${pincode}&format=json\n&limit=1&countrycodes=IN`,
      headers: {
        Cookie: "__cfduid=d87813cbe48abdce582fcd0f95df5d5331602794222",
      },
    };

    const latlongRes = await axios(config);
    // console.log(JSON.stringify(latlongRes.data));
    const lat = latlongRes.data[0].lat;
    const long = latlongRes.data[0].lon;
    // console.log(typeof lat);
    console.log(lat);
    console.log(long);

    //Generate the user ref_id;
    const ref_id = uuidv4();

    //Generate the user_id
    const user_id = uuidv4();

    //Insert the user details into the table
    const response = await pool.query(
      "INSERT INTO users (phone_no, pincode, password, lat , long , geolocation, ref_id, user_id) VALUES ($1, $2, $3, $4, $5, ST_MakePoint($5, $4),$6, $7 )",
      [
        phone_no,
        pincode,
        hashedPassword,
        parseFloat(lat),
        parseFloat(long),
        ref_id,
        user_id,
      ]
    );

    //Add the user to the ward in neo4j
    //1. First find ward_name of user, if not from mumbai assign to Outside-Mumbai node
    const wards_of_user = await util.getBMC_ward(lat, long);
    let ward_name_of_user = "";
    if (wards_of_user.length == 0) {
      console.log("user is not from Mumbai, cannot assign ward");
      ward_name_of_user = "Outside-Mumbai";
    } else {
      ward_name_of_user = wards_of_user[0].ward_name;
      console.log("ward name of user is ");
      console.log(ward_name_of_user);
    }
    //2. Add a relation between ward and user;
    console.log("I am adding this user ID in neo4j", user_id);
    const userDetails = { phone_no, pincode, lat, long, ref_id, user_id };
    await gdQueries.addUserToWard(ward_name_of_user, userDetails);

    //Check if someone has recommended the user our application
    if (req.params.ref_id != "no_ref") {
      //If yes, add the cypher query to connect the 2 users with the relation "recommended to"
      //here, ref_id is that of the new user and the req.params.id is the user who has recommended the new user the app
      gdQueries.connectUsers(ref_id, req.params.ref_id);
      console.log(ref_id);
      console.log(req.params.ref_id);
    }

    console.log("successfully queried");

    res.redirect("/user/login");

    // console.log(JSON.stringify(response.rows));
  } catch (err) {
    if (err.response && err.response.status && err.response.status == "404") {
      res.render("userRegister", {
        errors: [{ message: "Please enter a valid pincode" }],
        ref_id: req.params.ref_id,
      });
    } else {
      console.log(err);
      res.status(500).json({ msg: "Internal Server error" });
    }
  }
};

const userLogin = async (req, res) => {
  alert("Foo");
  let errors = [];
  const { phone_no, password } = req.body;
  await pool.query(
    "SELECT * FROM users WHERE phone_no = $1",
    [phone_no],
    (error, results) => {
      if (error) throw error;
      else {
        if (results.rows.length == 0) {
          errors.push({ message: "Register yourself first!" });
          console.log("NO MATCH");
          res.render("userRegister", { errors, ref_id: "no_ref" });
        } else {
          flag = 0;
          let user_id = "";
          for (var i = 0; i < results.rows.length; i++) {
            if (bcrypt.compareSync(password, results.rows[i].password)) {
              user_id = results.rows[i].user_id;
              flag = 1;
              break;
            }
          }
          if (flag == 1) {
            console.log("Matches");
            res.redirect(`/user/complaints/view/${user_id}`);
          } else {
            errors.push({ message: "Incorrect password!" });
            res.render("userLogin", { errors });
          }
        }
      }
    }
  );
};

//POST@ /users/complaints/post/:user_id
const postUserComplaintForm = async (req, res) => {
  try {
    const user_id = req.params.user_id;
    console.log("user id isS");
    console.log(user_id);
    let errors = [];
    // if (!req.body.images[0]) {
    //   errors.push({ message: "File not chosen" });
    //   res.render("uploadComplaintForm", { errors, user_id });
    // }
    if (!req.file) {
      errors.push({ message: "File not chosen, or incorrect format of file" });
      res.render("uploadComplaintForm", { errors, user_id, color: "red" });
    } else if (req.errmessage) {
      errors.push({ message: req.errmessage });
      res.render("uploadComplaintForm", { errors, user_id, color: "red" });
    } else {
      console.log(req.file.filename);

      //******************ML part*************************

      boolTrash = await util.detectTrash(
        `../public/active_complaints/${req.file.filename}`
      );
      //console.log("this is the type of ", typeof(boolTrash))
      const trashOrNot = boolTrash.trim().charAt(boolTrash.trim().length - 1);

      if (trashOrNot === "0") {
        errors.push({ message: "No trash detected" });
        res.render("uploadComplaintForm", { errors, user_id, color: "red" });
      }

      //get location from the photo
      console.log(req.file);
      const { filename, path } = req.file;

      let location = await util.getLocationFromPhoto(
        filename,
        "active_complaints"
      );
      console.log(location);

      const lat = location.lat;
      const long = location.lng;
      if (lat == 0) {
        errors.push({
          message:
            "Could not identify location of the picture. Make sure you have enabled your GPS and given permission to geocode your photos",
        });
        res.render("uploadComplaintForm", { errors, user_id, color: "red" });
      } else {
        //get the ward corresponding to the location of pic
        const wards = await util.getBMC_ward(lat, long);

        if (wards.length == 0) {
          errors.push({
            message: "Picture not taken in Mumbai, cannot assign a ward",
          });
          res.render("uploadComplaintForm", { errors, user_id, color: "red" });
        } else {
          const ward_id = wards[0].ward_id;
          console.log("the ward of the pic is");
          console.log(wards[0].ward_name);
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

          //get status of the complaint
          const status = "active";

          //generate the complaint_id
          const complaint_id = uuidv4();

          //find the address of the complaint
          const config = {
            method: "get",
            url: `https://us1.locationiq.com/v1/reverse.php?key=pk.9e8187ff3784e0e5cfef0fe6733bfd25&lat=${lat}&lon=${long}&format=json`,
            headers: {
              Cookie: "__cfduid=d87813cbe48abdce582fcd0f95df5d5331602794222",
            },
          };

          const addressRes = await axios(config);
          console.log(addressRes.data.display_name);

          const queryResult = await pool.query(
            "INSERT INTO active_complaints ( user_id, lat, long, geolocation,ward_id,   image, date,time, status, complaint_id, complaint_address) values ($1, $2, $3,ST_MakePoint($3, $2),  $4,$5, TO_DATE($7, $8),TO_TIMESTAMP($9, $10), $6, $11, $12)",
            [
              user_id,
              lat,
              long,
              ward_id,
              req.file.path,
              status,
              currentDate,
              "YYYYMMDD",
              currentTime,
              "HH24MIss",
              complaint_id,
              addressRes.data.display_name,
            ]
          );

          const complaintInfo = { lat, long, complaint_id };

          await complaintQueries.addComplaintToUser(user_id, complaintInfo);

          res.redirect(`/user/complaints/post/${user_id}`);
        }
      }
    }
    console.log(user_id);
  } catch (err) {
    throw err;
    res.send(err);
  }
};

//GET@ /user/complaints/post/:user_id
const getUserComplaintForm = async (req, res) => {
  try {
    res.render("uploadComplaint");
  } catch (err) {
    throw err;
  }
};

//GET@ /user/complaints/view/:user_id
const viewAllComplaints = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM active_complaints");
    const notifs = await pool.query(
      "SELECT * FROM resolved_complaints WHERE user_id=$1 AND status=$2",
      [req.params.user_id, "NR"]
    );
    let errors = [];
    if (notifs.rows.length != 0) {
      errors.push({
        message: "Hey, some of your complaints have been resolved!",
      });
    }
    console.log("in view all complaints");
    console.log(req.params.user_id);
    console.log(result.rows.length);
    res.render("allComplaints", {
      complaints: result.rows,
      user_id: req.params.user_id,
      errors,
      color: "orange",
    });
  } catch (error) {
    throw error;
  }
};

//POST @ /user/complaints/view/filter/:user_id
const filterComplaints = async (req, res) => {
  try {
    console.log("in here at filterComplaints");
    var buf = parseFloat(req.body.distance) * 1000;
    var user_id = req.params.user_id;
    console.log("the distance chosen by the user is:", buf);

    console.log(typeof buf);
    pool.query(
      "SELECT * FROM active_complaints,users WHERE st_intersects(active_complaints.geolocation,st_buffer(users.geolocation,$1))=$3 AND users.user_id=$2",
      [buf, user_id, 1],

      (err, result) => {
        if (err) throw err;

        console.log(result.rows);
        // var campaignItems = result.rows;
        // res.render("user_enroll", {
        //   campaignItems: campaignItems,
        //   user_id: user_id,
        // });
        res.render("allComplaints", {
          complaints: result.rows,
          user_id: req.params.user_id,
        });
      }
    );
  } catch (err) {
    throw err;
  }
};

const activeDrives = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM campaign WHERE date>=CURRENT_DATE"
    );
    // console.log(result);
    var campaignItems = result.rows;
    var addressArr = [];
    // console.log(campaignItems.length);
    for (var i = 0; i < campaignItems.length; i++) {
      var lat = campaignItems[i].lat_of_start;
      var long = campaignItems[i].long_of_start;
      const config = {
        method: "get",
        url: `https://us1.locationiq.com/v1/reverse.php?key=pk.9e8187ff3784e0e5cfef0fe6733bfd25&lat=${lat}&lon=${long}&format=json`,
        headers: {
          Cookie: "__cfduid=d87813cbe48abdce582fcd0f95df5d5331602794222",
        },
      };

      const addressRes = await axios(config);
      // console.log(JSON.stringify(latlongRes.data));
      // console.log(JSON.stringify(addressRes.data));
      const addr = addressRes.data.display_name;

      // console.log(typeof lat);
      console.log(addr);
      addressArr[i] = addr;
    }
    // console.log(addressArr);

    var user_id = req.params.user_id;
    // console.log(user_id);

    // console.log(result.rows);
    // console.log(campaignItems[0].campaign_name);

    res.render("user_enroll", {
      campaignItems: campaignItems,
      user_id: user_id,
      addressArr: addressArr,
    });
  } catch (err) {
    throw err;
  }
};

const participateCampaign = (req, res) => {
  const user_id = req.params.user_id;
  const campaign_id = req.body.enroll;
  const campaign_name = req.body.camp_name;
  // console.log(user_id);
  // console.log(campaign_id);
  console.log(campaign_name);

  // console.log(typeof(user_id));

  pool.query(
    "INSERT INTO campaign_participation (user_id, campaign_id, campaign_name) VALUES ($1, $2, $3)",
    [user_id, campaign_id, campaign_name],
    (err, result) => {
      if (err) throw err;
      else {
        res.redirect("/user/drives/enroll/" + user_id);
      }
    }
  );
};

const filterCampaign = async(req, res) =>  {
  try{
  var buf = parseFloat(req.body.distance) * 1000;
  var user_id = req.params.user_id;
  
  console.log(typeof buf);
  const result = await pool.query(
    "SELECT * FROM campaign,users WHERE st_intersects(campaign.geolocation,st_buffer(users.geolocation,$1)) AND users.user_id=$2 AND campaign.date>=CURRENT_DATE",
    [buf, user_id],
  );
  var campaignItems = result.rows;
  var addressArr = [];

  for(var i=0; i<campaignItems.length; i++)
    {
      var lat = campaignItems[i].lat_of_start;
      var long = campaignItems[i].long_of_start;
      const config = {
      method: "get",
      url: `https://us1.locationiq.com/v1/reverse.php?key=pk.9e8187ff3784e0e5cfef0fe6733bfd25&lat=${lat}&lon=${long}&format=json`,
      headers: {
        Cookie: "__cfduid=d87813cbe48abdce582fcd0f95df5d5331602794222",
      },
     };
     const addressRes = await axios(config);
    // console.log(JSON.stringify(latlongRes.data));
    // console.log(JSON.stringify(addressRes.data));
      const addr = addressRes.data.display_name;
    
    // console.log(typeof lat);
      console.log(addr);
      addressArr[i]=addr;
    }
    res.render("user_enroll", {
      campaignItems: campaignItems,
      user_id: user_id,
      addressArr:addressArr
    });
  }catch(err){
    throw err;
  }
};

//GET @ /user/profile/view/:user_id

const getUserProfilePage = async (req, res) => {
  try {
    const user_id = req.params.user_id;
    const result = await pool.query("SELECT * FROM users WHERE user_id=$1", [
      user_id,
    ]);
    const ref_id = result.rows[0].ref_id;

    const rewardPoints = await gdQueries.calculateUserRewardPoints(ref_id);

    const refLink = `http://localhost:5000/user/register/${ref_id}`;
    res.render("userProfile", {
      ref_id: ref_id,
      user_id: user_id,
      rewardPoints,
      refLink,
    });
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const viewMyActiveComplaints = async (req, res) => {
  try {
    const user_id = req.user[0].user_id;
    const response = await pool.query(
      "SELECT * FROM active_complaints WHERE user_id=$1",
      [user_id]
    );
    res.render("userMyActiveComplaints", {
      complaints: response.rows,
      user_id: req.params.user_id,
    });
  } catch (error) {
    throw error;
  }
};

const viewMyResolvedComplaints = async (req, res) => {
  try {
    const user_id = req.user[0].user_id;
    const response = await pool.query(
      "SELECT * FROM resolved_complaints WHERE user_id=$1 order by status",
      [user_id]
    );
    res.render("userMyResolvedComplaints", {
      complaints: response.rows,
      user_id: req.params.user_id,
    });
  } catch (error) {
    throw error;
  }
};

const acknowledgeComplaintResolution = async (req, res) => {
  // try {
  //   const user_id = req.params.user_id;
  //   const resolved_complaint_id = req.params.resolved_complaint_id;

  //   await pool.query(
  //     "UPDATE resolved_complaints SET status=$1 WHERE complaint_id=$2",
  //     ["R", resolved_complaint_id]
  //   );
  //   res.redirect(`/user/complaints/view/resolved/${user_id}`);
  // } catch (error) {
  //   throw error;
  // }
  try {
    const user_id = req.params.user_id;
    const resolved_complaint_id = req.params.resolved_complaint_id;
    const rating = req.body.input1;
    console.log(typeof rating);
    console.log("user rating is:", rating);
    if (!rating) {
      rating = 0;
    }
    await pool.query(
      "UPDATE resolved_complaints SET status=$1, acknowledgment=$3 WHERE complaint_id=$2",
      ["R", resolved_complaint_id, rating]
    );
    res.redirect(`/user/complaints/view/resolved/${user_id}`);
  } catch (error) {
    throw error;
  }
};

const souchalay = async (req, res) => {
  try {
    const user_id = req.params.user_id;
    let errors = [];
    const { pincode } = req.body;

    //Find out the lat and long of the user from the pincode using the locationIQ API
    const config = {
      method: "get",
      url: `https://us1.locationiq.com/v1/search.php?key=pk.9e8187ff3784e0e5cfef0fe6733bfd25&postalcode=${pincode}&format=json\n&limit=1&countrycodes=IN`,
      headers: {
        Cookie: "__cfduid=d87813cbe48abdce582fcd0f95df5d5331602794222",
      },
    };

    const latlongRes = await axios(config);
    // console.log(JSON.stringify(latlongRes.data));
    const lat = latlongRes.data[0].lat;
    const long = latlongRes.data[0].lon;
    // console.log(typeof lat);
    console.log(lat);
    console.log(long);

    /*const response = await pool.query(
      "SELECT * FROM active_complaints WHERE ward_id=$1",
      [ward_id]
    );*/

    const response = await pool.query(
      "SELECT lat,long FROM latrine WHERE st_intersects(ST_MakePoint($1, $2),st_buffer(latrine.latrine_location,10000))",
      [lat, long]
    );

    var test1 = [];
    var test2 = [];
    for (var i = 0; i < response.rows.length; i++) {
      test1.push([response.rows[i].lat, response.rows[i].long]);
    }

    console.log("First arrau");

    for (var i = 0; i < test1.length; i++) {
      console.log(test1[i][0]);
      console.log(test1[i][1]);
    }

    console.log("After test1");
    for (var i = 0; i < response.length; i++) {
      console.log(response.rows[i].lat);
      console.log("BYE");
    }

    const latl = response.rows;
    res.render("souchalayMap", { latl, user_id});

    

    // console.log(JSON.stringify(response.rows));
  } catch (err) {
    if (err.response && err.response.status && err.response.status == "404") {
      res.render("userRegister", {
        errors: [{ message: "Please enter a valid pincode" }],
      });
    } else {
      console.log(err);
      res.status(500).json({ msg: "Internal Server error" });
    }
  }
};

const viewDrivesOnMap = async (req, res) => {
  try {
    const user_id = req.params.user_id;
    const result = await pool.query("SELECT * FROM campaign");
    // console.log(result.rows);
    var allDrives = result.rows;
    res.render("userDriveMap", {
      allDrives: allDrives,
    });
  } catch (error) {
    throw error;
    res.send(error);
  }
};

const getEnrolledDrives = async (user_id) => {
  try {
    const response = await pool.query(
      "SELECT * FROM campaign_participation WHERE user_id=$1",
      [user_id]
    );
    return response.rows;
  } catch (err) {
    throw err;
  }
};

const feedbackInsert = async (req, res) => {
  try {
    var user_id = req.params.user_id;
    var feedback = req.body.feedback;
    var campaign_name = req.body.drivesEn;
    // console.log(typeof(user_id));
    console.log(feedback);
    console.log(user_id);
    console.log(campaign_name);

    //ML part
    const sentiment = await util.getSentimentFromText(feedback);
    console.log("the sentiment is:", sentiment);

    var sent = parseInt(sentiment);

    const response = await pool.query(
      "SELECT campaign_id FROM campaign WHERE campaign_name=$1",
      [campaign_name]
    );
    var campaign_id = response.rows[0].campaign_id;
    console.log(response.rows[0].campaign_id);
    pool.query(
      "UPDATE campaign_participation SET feedback=$1 WHERE user_id=$2 AND campaign_id=$3",
      [feedback, user_id, campaign_id]
    );
    res.redirect("/user/drives/enroll/feedback/" + user_id);

    pool.query(
      "UPDATE campaign SET sentiments=sentiments + $1 WHERE campaign_id=$2",
      [sent, campaign_id]
    );
  } catch (err) {
    throw err;
  }
};

module.exports = {
  userRegister,
  userLogin,
  viewAllComplaints,
  postUserComplaintForm,
  getUserComplaintForm,
  activeDrives,
  participateCampaign,
  filterCampaign,
  getUserProfilePage,
  viewMyActiveComplaints,
  viewMyResolvedComplaints,
  acknowledgeComplaintResolution,
  souchalay,
  getUserProfilePage,
  viewDrivesOnMap,
  getEnrolledDrives,
  feedbackInsert,
  filterComplaints,
};
