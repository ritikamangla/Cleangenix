const wards = require("../geoJSON/BMC_wards");
const pool = require("../pool");
const { v4: uuidv4 } = require("uuid");
const gdb_queries = require("../graph_queries/userQueries");
const request = require("request");
const moment = require("moment");
const bcrypt = require("bcrypt");
const axios = require("axios");
const alert = require("alert");

const insertWardGeoJSON = async (req, res) => {
  try {
    var i = 0;

    wards.wards.features.forEach(async (feature) => {
      const response = await pool.query(
        "INSERT INTO ward(ward_name, rewards, ward_location, username, password ) VALUES ($1, $2, ST_setSRID(ST_GeomFromGeoJSON($3)::geography,4326), $4, $5 )",
        [
          feature.properties.name,
          10,
          JSON.stringify(feature.geometry),
          `wardID${feature.properties.name}`,
          `mypassword${feature.properties.name}`,
        ]
      );
    });
    wards.wards.features.forEach(async (feature) => {
      const ward_id = uuidv4();
      await gdb_queries.insertWardInGraphDB(ward_id, feature.properties.name);
    });
    await gdb_queries.insertWardInGraphDB(uuidv4(), "Outside-Mumbai");

    res.send("success");
  } catch (error) {
    throw error;
  }
};

//ward login
const adminLogin = async (req, res) => {
  
  let errors = [];


  const { username, password } = req.body;
  await pool.query(
    "SELECT * FROM ward WHERE username = $1",
    [username],
    (error, results) => {
      if (error) throw error;
      else {
        if (results.rows.length == 0) {
          errors.push({ message: "Incorrect ward username" });
          console.log("NO MATCH");
          res.render("adminLogin", { errors });
        } else {
          flag = 0;
          let user_id = "";
          for (var i = 0; i < results.rows.length; i++) {
            // if (bcrypt.compareSync(password, results.rows[i].password)) {
            //   ward_id = results.rows[i].ward_id;
            //   flag = 1;
            //   break;
            // }
            if (password === results.rows[i].password) {
              ward_id = results.rows[i].ward_id;
              flag = 1;
              break;
            }
          }
          if (flag == 1)
          {
              
              
              console.log("HI");


            console.log("Matches");
            res.redirect(`/admin/home/${ward_id}`);
          } else {
            errors.push({ message: "Incorrect password" });
            res.render("adminLogin", { errors });
          }
        }
      }
    }
  );
};

const getAdminDetails = async (ward_id) => {
  try {
    const activec = await pool.query(
      "SELECT count(*) FROM active_complaints WHERE ward_id=$1",
      [ward_id]
    );

    const resolvec = await pool.query(
      "SELECT count(*) FROM resolved_complaints WHERE ward_id=$1",
      [ward_id]
    );

    var list = [];
    list[0] = activec.rows[0].count;
    list[1] = resolvec.rows[0].count;

    console.log("BYEEEE");
    console.log(list[0]);
    console.log(list[1]);

    //console.log(response.rows);
    return list;
  } catch (error) {
    throw error;
  }
};

module.exports = { insertWardGeoJSON, adminLogin , getAdminDetails,};
