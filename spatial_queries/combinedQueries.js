const adminQueries = require("./adminQueries");
const userQueries = require("./userQueries");
const complaintQueries = require("./complaintQueries");
const workerQueries = require("./workerQueries");
const campaignQueries = require("./campaignQueries");
//Admin Queries

//User Queries

const userRegister = userQueries.userRegister;
const userLogin = userQueries.userLogin;
const postUserComplaintForm = userQueries.postUserComplaintForm;
const viewAllComplaints = userQueries.viewAllComplaints;
const getUserComplaintForm = userQueries.getUserComplaintForm;
const activeDrives = userQueries.activeDrives;
const participateCampaign = userQueries.participateCampaign;
const filterCampaign = userQueries.filterCampaign;
const insertWardGeoJSON = adminQueries.insertWardGeoJSON;
const getUserProfilePage = userQueries.getUserProfilePage;
const viewDrivesOnMap = userQueries.viewDrivesOnMap;
const getEnrolledDrives = userQueries.getEnrolledDrives;
const feedbackInsert = userQueries.feedbackInsert;
const adminLogin = adminQueries.adminLogin;

const getActiveComplaints = complaintQueries.getActiveComplaints;
const resolveComplaint = complaintQueries.resolveComplaint;
const getResolvedComplaints = complaintQueries.getResolvedComplaints;

const workerLogin = workerQueries.workerLogin;

const postWorkerResolvedForm = workerQueries.postWorkerResolvedForm;
const viewMyActiveComplaints = userQueries.viewMyActiveComplaints;
const viewMyResolvedComplaints = userQueries.viewMyResolvedComplaints;
const acknowledgeComplaintResolution =
  userQueries.acknowledgeComplaintResolution;

const souchalay = userQueries.souchalay;

const initiateCampaign = campaignQueries.initiateCampaign;
const getCampaignName = campaignQueries.getCampaignName;
const viewParticipants = campaignQueries.viewParticipants;
const collectCampSenti = campaignQueries.collectCampSenti;
const numberOfPart = campaignQueries.numberOfPart;
const wardName = campaignQueries.wardName;

//Worker Queries

module.exports = {
  userRegister,
  userLogin,
  postUserComplaintForm,
  viewAllComplaints,
  getUserComplaintForm,
  activeDrives,
  participateCampaign,
  filterCampaign,
  insertWardGeoJSON,
  getUserProfilePage,
  adminLogin,
  getActiveComplaints,
  resolveComplaint,
  getResolvedComplaints,
  workerLogin,
  postWorkerResolvedForm,
  viewMyActiveComplaints,
  viewMyResolvedComplaints,
  acknowledgeComplaintResolution,
  souchalay,
  initiateCampaign,
  getCampaignName,
  viewParticipants,
  viewDrivesOnMap,
  getEnrolledDrives,
  feedbackInsert,
  collectCampSenti,
  numberOfPart,
  wardName,
};
