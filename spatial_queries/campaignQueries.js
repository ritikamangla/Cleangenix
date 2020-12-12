const pool = require("../pool");
const util = require("../utilities");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const gdb_queries = require("../graph_queries/userQueries");
const request = require("request");
const moment = require("moment");
const bcrypt = require("bcrypt");
const axios = require("axios");
const alert = require("alert");
const { time } = require("console");

//Insert in campaign table

const initiateCampaign = async (req, res) => {
try {
    const street = req.body.street;
    const campaign_name = req.body.campaign_name;
    const radius = req.body.radius;
    const date = req.body.date;
    const start_time = req.body.start_time;
    const end_time = req.body.end_time;

    const config = {
        method: "get",
        url: `https://us1.locationiq.com/v1/search.php?key=pk.9e8187ff3784e0e5cfef0fe6733bfd25&street=${street}&format=json\n&limit=1&countrycodes=IN`,
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
  
      //Generate the user campaign_id;
    const campaign_id = uuidv4();
  

    var ward_id = req.params.ward_id;
    


    const queryresult = await pool.query(
      "INSERT INTO campaign (campaign_id, organiser_ward_id,campaign_name,lat_of_start,long_of_start,radius,date,time_of_start,time_of_end,ongoing,geolocation,sentiments) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, ST_MakePoint($5, $4),0)",
      [campaign_id, 
        ward_id,
        campaign_name,
        lat,
        long,
        radius,
        date,
        start_time,
        end_time
      ],
    //   (err, result) => {
    //     if (err) throw err;
    //     else {
    //       res.redirect("/admin/drives/initiate/" + ward_id);
    //     }
    //   }

    );
    res.redirect(`/admin/drives/initiate/${ward_id}`);
    } catch (err) {
    throw err;
    res.send(err);
  }
  };

  const getCampaignName = async (ward_id) => {
    try{
        
        const response = await pool.query(
            "SELECT campaign_name FROM campaign WHERE organiser_ward_id=$1 ",
            [ward_id]
          );
          console.log(response.rows);
          return response.rows;

    }catch (err) {
        throw err;
    }
  }

  const viewParticipants = async (req,res) => {
      try{
          var ward_id = req.params.ward_id;
          const campaign_name = req.body.campaign_list;
          console.log(campaign_name);
          const response1 = await pool.query(
            "SELECT * FROM campaign WHERE campaign_name=$1",
            [campaign_name]
          );
            console.log(response1.rows[0].campaign_id);
          const response2 = await pool.query(
            "SELECT * FROM campaign_participation WHERE campaign_id=$1",
            [response1.rows[0].campaign_id]
          );
            console.log(ward_id)
          const response3 = await pool.query(
            "SELECT * FROM campaign WHERE organiser_ward_id=$1 ",
            [ward_id]
          );
          const response4 = await pool.query("SELECT COUNT(*) FROM campaign_participation");
          console.log(response4.rows[0].count);
          
        const campaign_details = response2.rows;
        const campaign_names = response3.rows;
        res.render("adminViewPart", {
            ward_id:ward_id,
            campaign_items: campaign_names,
            campaign_details:campaign_details,
            campaign_name:campaign_name,
            date:response1.rows[0].date,
            count:response4.rows[0].count,
        });   

      }catch(err) {
          throw err;
          res.send(err);
      }
  }

  const collectCampSenti = async (req,res) => {
    try{
      const response = await pool.query("SELECT * FROM campaign WHERE DATE<CURRENT_DATE");
      return response.rows;
    }catch(err){
      throw err;
    }
  }

  const numberOfPart = async(req,res) =>{
    try{
      const response = await pool.query("SELECT COUNT(user_id) FROM campaign_participation GROUP BY campaign_id");
      return response.rows;
    }catch(err){
      throw err;
    }
  }

  const wardName = async(req,res) => {
    try{
      const response = await pool.query("SELECT * FROM ward");
      return response.rows;
    }catch(err){
      throw err;
    }
  }


  module.exports = {
    initiateCampaign,
    getCampaignName,
    viewParticipants,
    collectCampSenti,
    numberOfPart,
    wardName,
  };