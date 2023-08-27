const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();
require('dotenv').config();
app.use(cors());
app.use(express.json());

const dbUsername = process.env.DB_USERNAME;
const dbPassword = process.env.DB_PASSWORD;
const dbCluster = process.env.DB_CLUSTER;
mongoose.connect(`mongodb+srv://${dbUsername}:${dbPassword}@${dbCluster}.mongodb.net/?retryWrites=true&w=majority`);

const usersSchema = new mongoose.Schema({
  name: String,
  email: String,
  auth0Id: String,
  plans: Array
});

const submittedSchema = new mongoose.Schema({
  category: String,
  submissions: [String]
});

const plansSchema = new mongoose.Schema({
  name: String,
  description: String,
  coverPicture: Number,
  users: Array,
  startDate: Date,
  voteTime: Number,
  inputTime: Number,
  datesAvailable: Array,
  datesSubmitted: Array,
  dates: Array,
  lengthStay: Array,
  locations: Array,
  residences: Array,
  transport: Array,
  activities: Array,
  addresses: Array,
  phoneNumbers: Array,
  statusPlan: String,
  statusStage: String,
  statusInputVote: String,
  lastCheck: String,
  submitted: [submittedSchema]
})

const UserModel = mongoose.model('Users', usersSchema);
const PlanModel = mongoose.model('Plans', plansSchema); 


app.get('/api/users', async (req, res) => {
  const myData = await UserModel.find();
  res.json(myData);
});

// ADD PLAN
app.post('/api/plans', async (req, res) => {
  let today = new Date();
  today.setHours(0, 0, 0, 0);
  var todayNoTime = today.getFullYear()+'/'+(today.getMonth()+1)+'/'+today.getDate();
  const newPlan = new PlanModel ({
    name: req.body.namePlan,
    description: req.body.description,
    coverPicture : req.body.coverPicture,
    inputTime: req.body.inputTime,
    voteTime: req.body.voteTime,
    users: req.body.users,
    startDate: today,
    datesAvailable: [],
    datesSubmitted: [],
    locations: [],
    lengthStay: [],
    residences: [],
    transport: [],
    activities: [],
    addresses: [],
    phoneNumbers: [],
    statusPlan: "In Progress",
    statusStage: "Input Dates & Location",
    statusInputVote: `${req.body.inputTime} days to`,
    lastCheck: todayNoTime
  });
  await newPlan.save();
  res.json(newPlan);
});

// UPDATE PLAN
app.put('/api/plans/:id', async (req, res) => {
  const id = req.params.id;
  const { statusPlan, 
    statusStage, 
    statusInputVote, 
    lastCheck } = req.body;
  
  const updatesPlan = await PlanModel.findOneAndUpdate(
    { _id: id },
    {
      statusPlan,
      statusStage,
      statusInputVote,
      lastCheck
    },
    { new: true }
  );  
  res.json(updatesPlan);
});

// ADD USER TO PLAN
app.put('/api/plans/:id/addUser', async (req, res) => {
  const id = req.params.id;
  const user = req.body.auth0;
  const updatesPlan = await PlanModel.findOneAndUpdate(
    { _id: id },
    { $push: {
      users:  user
    }
    },
    { new: true }
  );  
  res.json(updatesPlan);
});

// UPDATE DATES + LENGTH
app.put('/api/plans/:id/updateDates', async (req, res) =>{
  const id = req.params.id;
  const addedDates = req.body.dates;
  const lengthStay = req.body.lengthTrip;
  const personId = req.body.auth0Id;
  const updatesDates = await PlanModel.findOneAndUpdate(
    {_id: id},
    { $push: { 
      datesAvailable: { $each: addedDates }, 
      lengthStay: { $each: lengthStay },
      datesSubmitted: { $each: personId }  } },
    { new: true })
    res.json(updatesDates)
});

// UPDATE DATE VOTE OPTIONS
app.put('/api/plans/:id/datesVotesOptions', async (req, res) =>{
  const id = req.params.id;
  const finalVoteOptions = req.body;
  const updateDatesVoteOption = await PlanModel.findOneAndUpdate(
    {_id: id},
    { $push: { 
      dates: { $each: finalVoteOptions } } },
    { new: true })
    res.json(updateDatesVoteOption)
});

// ADD VOTES TO CATEGORY
app.put('/api/plans/:id/submitVotes/:category', async (req, res) => {
  const id = req.params.id;  
  const category = req.params.category;
  const voteOptions = req.body;
  try {
    const planModel = await PlanModel.findById(id);

    if (!planModel) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    voteOptions.forEach((element, index) => {
      let datePoints = element.points;
      if (planModel[category][index].points) {
        datePoints += planModel[category][index].points;
      }
      planModel[category][index].points = datePoints;
    });
    planModel.markModified(category);
    const newPlanModel = await planModel.save();
    res.json(newPlanModel);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

// USER HAS SUBMITTED CATEGORY
app.put('/api/plans/:id/submitted/:category', async (req, res) => {
  const id = req.params.id;  
  const category = req.params.category;
  const auth0Id = req.body.auth0Id;
  
  try {
    const planModel = await PlanModel.findById(id);

    if (!planModel) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    const submittedCategory = planModel.submitted.find(submitted => submitted.category === category);
    if (!submittedCategory) {
      planModel.submitted.push({ category, submissions: [] });
    }
    const submissions = planModel.submitted.find(submitted => submitted.category === category).submissions;
    submissions.push(auth0Id);    
    planModel.markModified('submitted');
    const newPlanModel = await planModel.save();
    res.json(newPlanModel);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

// GET CATEGORY SUBMISSIONS
app.get('/api/plans/:id/submissions/:category/:auth0Id', async (req, res) => {
  const id = req.params.id;
  const category = req.params.category;
  const auth0Id = req.params.auth0Id;

  try {
    const planModel = await PlanModel.findById(id);

    if (!planModel) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const hasUserVoted = checkUserHasVoted(planModel, category, auth0Id);
    res.json(hasUserVoted);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

function checkUserHasVoted(planModel, category, auth0Id) {
  const submittedCategory = planModel.submitted.find(submitted => submitted.category === category);
  if (submittedCategory) {
    const submittedUser = submittedCategory.submissions.find(user => user === auth0Id);
    if (submittedUser) {
      return true;
    }
  }
  return false;
}

// GET DATE VOTE OPTIONS
app.get('/api/plans/:id/datesVotesOptions', async (req, res) =>{
  try {
    const id = req.params.id;
    const myData = await PlanModel.distinct('dates', { _id: id });
    res.json(myData);
  }
  catch (err) {
    res.json("failed");
    }
});

// GET PLAN BY ID
app.get('/api/plans/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const myData = await PlanModel.findOne({ _id: id });
    res.json(myData);
  }
  catch (err) {
    res.json("failed");
    }
});

// UPDATE LOCATIONS
app.put('/api/plans/:id/updateLocations', async (req, res) =>{
  const id = req.params.id;
  const placeName = req.body.placeName;
  const motivation = req.body.motivation;
  const username = req.body.username;
  const location = {
    name: placeName,
    motivation,
    username
  }
  const updatesLocations = await PlanModel.findOneAndUpdate(
    {_id: id},
    { $push: { 
      locations: { $each: [location] } } },
    { new: true })
    res.json(updatesLocations)
})

// GET ALL FROM CATEGORY
app.get('/api/plans/:id/:category', async (req, res) => {
  const id = req.params.id;
  const category = req.params.category;
  const myData = await PlanModel.distinct(category, { _id: id });
  res.json(myData);
});

// UPDATE RESIDENCES
app.put('/api/plans/:id/updateResidences', async (req, res) =>{
  const id = req.params.id;
  const location = req.body.location;
  const url = req.body.url;
  const username = req.body.username;
  const motivation = req.body.motivation;
  const residence = {
    location,
    motivation,
    url,
    username
  }
  const updatesResidences = await PlanModel.findOneAndUpdate(
    {_id: id},
    { $push: { 
      residences: { $each: [residence] } } },
    { new: true })
    res.json(updatesResidences)
})

// UPDATE TRANSPORT
app.put('/api/plans/:id/updateTransport', async (req, res) =>{
  const id = req.params.id;
  const mode = req.body.mode;
  const time = req.body.time;
  const urlTickets = req.body.urlTickets;
  const urlRoute = req.body.urlRoute;
  const motivation = req.body.motivation;
  const username = req.body.username;
  const transport = {
    mode,
    time,
    urlTickets,
    urlRoute,
    motivation,
    username
  }
  const updatesTransport = await PlanModel.findOneAndUpdate(
    {_id: id},
    { $push: { 
      transport: { $each: [transport] } } },
    { new: true })
    res.json(updatesTransport)
})

// UPDATE ACTIVITIES
app.put('/api/plans/:id/updateActivity', async (req, res) =>{
  const id = req.params.id;
  const name = req.body.name;
  const urlSite = req.body.urlSite;
  const urlRoute = req.body.urlRoute;
  const motivation = req.body.motivation;
  const username = req.body.username;
  const activity = {
    name,
    urlSite,
    urlRoute,
    motivation,
    username
  }
  const updatesActivity = await PlanModel.findOneAndUpdate(
    {_id: id},
    { $push: { 
      activities: { $each: [activity] } } },
    { new: true })
    res.json(updatesActivity)
})

// UPDATE ADDRESSES
app.put('/api/plans/:id/updateAddresses', async (req, res) =>{
  const id = req.params.id;
  const name = req.body.name;
  const location = req.body.location;
  const address = {
    name,
    location,
  }
  const updatesAddress = await PlanModel.findOneAndUpdate(
    {_id: id},
    { $push: { 
      addresses: { $each: [address] } } },
    { new: true })
    res.json(updatesAddress)
})

// UPDATE PHONE NUMBERS
app.put('/api/plans/:id/updatePhoneNumbers', async (req, res) =>{
  const id = req.params.id;
  const name = req.body.name;
  const number = req.body.number;
  const phoneNumber = {
    name,
    number,
  }
  const updatesPhoneNumbers = await PlanModel.findOneAndUpdate(
    {_id: id},
    { $push: { 
      phoneNumbers: { $each: [phoneNumber] } } },
    { new: true })
    res.json(updatesPhoneNumbers)
})

// CHECK WHETHER USER HAS SUBMITTED DATES
app.get('/api/plans/:id/submittedDates/:auth0Id', async (req, res) => {
  const id = req.params.id;
  const auth0Id = req.params.auth0Id;
  const myData = await PlanModel.find({
    _id: id,
    datesSubmitted: auth0Id
  });
  if (myData.length > 0) {
    res.json({ submitted: true });
  } else {
    res.json({ submitted: false });
  }
});

// REPLACE CATEGORY FROM PLAN
app.put('/api/plans/:id/replace/:category', async (req, res) => {
  const id = req.params.id;
  const category = req.params.category;
  const sortedByPoints = req.body;

  try {
    const updatedPlanModel = await PlanModel.findOneAndUpdate(
      { _id: id },
      { $set: { [category]: sortedByPoints } },
      { new: true }
    );

    if (!updatedPlanModel) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    res.json(updatedPlanModel);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred' });
  }
});


// ADD USER
app.post('/api/users', async (req, res) => {
  const newUser = new UserModel ({
    name: req.body.name,
    email: req.body.email,
    auth0Id: req.body.auth0Id,
    plans: []
  });
  await newUser.save();
  res.json(newUser);
});

// GET USER BY AUTH0ID
app.get(`api/users/:auth0Id`, async (req, res) => {
  const auth0Id = req.params.auth0Id;
  const myData = await UserModel.findOne({auth0Id: auth0Id});
  if (myData) {
    res.json(myData);
  } else {
    res.status(404).send("User not found");
  }
});

// UPDATE USER PLANS
app.put('/api/users/:auth0Id/plans', async (req, res) => {
  const auth0Id = req.params.auth0Id;
  const planId = req.body.planId;
  const updatesPlans = await UserModel.findOneAndUpdate(
    { auth0Id: auth0Id },
    { $push: { plans: { $each: [planId] } } },
    { new: true }
  );
  res.json(updatesPlans);
});

// GET ALL USER PLANS
app.get('/api/users/:auth0Id/plans', async (req, res) => {
  const auth0Id = req.params.auth0Id;
  const myData = await UserModel.distinct('plans', { auth0Id: auth0Id });
  res.json(myData);
});

// Start the server
app.listen(3000, () => {
  console.log('Server started');
});

module.exports = app;
