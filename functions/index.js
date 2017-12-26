'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });
admin.initializeApp(functions.config().firebase);

const ref = admin.database().ref();

exports.update_lotDetails_OnApplication_OnNewChange = functions.https.onRequest((req, res) => {
  ref.child('applications').once('value').then(snapshot => {
    snapshot.forEach(element => {
      var lot = element.val().lot;
      if (lot) {
        getLotDetails(lot).then(tokens => {
          element.ref.update({ lotdetails: tokens });
        });
      }
      else {
        element.ref.update({ lotdetails: '' });
      }
    });
    res.status(200).send('lot data updates: ok');
  }).catch(reason => {
    res.status(200).send('lot Data Updates: ' + reason);
  });
});

exports.update_agentdetails_OnApplication_OnNewChange = functions.https.onRequest((req, res) => {
  ref.child('applications').once('value').then(snapshot => {
    snapshot.forEach(element => {
      var agent = element.val().agent;
      if (agent) {
        getAgentDetails(agent).then(tokens => {
          element.ref.update({ agentdetails: tokens });
        });
      }
      else {
        element.ref.update({ agentdetails: '' });
      }
    });
    res.status(200).send('agent data updates: ok');
  }).catch(reason => {
    res.status(200).send('agent Data Updates: ' + reason);
  });
});

exports.update_buyerdetails_OnApplication_OnNewChange = functions.https.onRequest((req, res) => {
  ref.child('applications').once('value').then(snapshot => {
    snapshot.forEach(element => {
      var buyer = element.val().buyer;
      if (buyer) {
        getBuyerDetails(buyer).then(tokens => {
          element.ref.update({ buyerdetails: tokens });
        });
      }
      else {
        element.ref.update({ buyerdetails: '' });
      }
    });
    res.status(200).send('buyer data updates: ok');
  }).catch(reason => {
    res.status(200).send('buyer Data Updates: ' + reason);
  });
});

exports.getServerCurrentDateTime = functions.https.onRequest((req, res) => {
  var currentdatetime = new Date();
  res.status(200).send(currentdatetime);

});


exports.applications = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    // res.status(200).send({test: 'Testing functions'});
    ref.child('lots').once('value').then(snapshot => {
      // res.status(200).send(snapshot.JSON());

      var arr = [];

      snapshot.forEach(element => {
        arr.push(element);
      });

      res.status(200).send(arr);

    }).catch(reason => {
      res.status(200).send(reason);
    });
  });
});


const getLotDetails = (lot) => {
  return admin.database().ref('/lots/' + lot).once('value').then(snap => {
    return snap.val();
  });
}

const getAgentDetails = (agent) => {
  return admin.database().ref('/agents/' + agent).once('value').then(snap => {
    return snap.val();
  });
}

const getBuyerDetails = (buyer) => {
  return admin.database().ref('/buyers/' + buyer).once('value').then(snap => {
    return snap.val();
  });
}