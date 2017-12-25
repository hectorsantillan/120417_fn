'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

const ref = admin.database().ref();

exports.update_lotDetails_OnApplication_OnNewChange = functions.https.onRequest((req, res) => {
  ref.child('applications').once('value').then(snapshot => {
    snapshot.forEach(element => {
      return getLotDetails(element.val().lot).then(tokens => {
        element.ref.update({ lotdetails: JSON.stringify(tokens) });
      });
    });
    res.status(200).send('lot data updates: ok');
  }).catch(reason => {
    res.status(200).send('lot Data Updates: ' + reason);
  });
});

exports.update_agentdetails_OnApplication_OnNewChange = functions.https.onRequest((req, res) => {
  ref.child('applications').once('value').then(snapshot => {
    snapshot.forEach(element => {
      return getAgentDetails(element.val().agent).then(tokens => {
        element.ref.update({ agentdetails: JSON.stringify(tokens) });
      });
    });
    res.status(200).send('agent data updates: ok');
  }).catch(reason => {
    res.status(200).send('agent Data Updates: ' + reason);
  });
});

exports.update_buyerdetails_OnApplication_OnNewChange = functions.https.onRequest((req, res) => {
  ref.child('applications').once('value').then(snapshot => {
    snapshot.forEach(element => {
      return getBuyerDetails(element.val().buyer).then(tokens => {
        element.ref.update({ buyerdetails: JSON.stringify(tokens) });
      });
    });
    res.status(200).send('buyer data updates: ok');
  }).catch(reason => {
    res.status(200).send('buyer Data Updates: ' + reason);
  });
});


function getLotDetails(lot) {
  return admin.database().ref('/lots/' + lot).once('value').then(snap => {
    return snap.val();
  });
}

function getAgentDetails(agent) {
  return admin.database().ref('/agents/' + agent).once('value').then(snap => {
    return snap.val();
  });
}

function getBuyerDetails(buyer) {
  return admin.database().ref('/buyers/' + buyer).once('value').then(snap => {
    return snap.val();
  });
}