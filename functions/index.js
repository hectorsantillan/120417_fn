/**
* model syntax
*/
// ref.child('statuscolor').orderByChild('color').equalTo('violet').once('value').then(snapshot => {
//   snapshot.forEach(element => {
//     updates['/statuscolor/' + element.key + '/color'] = "gray";
//   });

// }).catch(reason => {
//   res.status(500).send('status color: ' + reason);
// });

'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

const ref = admin.database().ref();

exports.dailyLotStatusUpdate = functions.https.onRequest((req, res) => {
  const currentDate = new Date();
  var updates = {};




  ref.child('lots').orderByChild('status').equalTo('available').once('value').then(snapshot => {
    snapshot.forEach(element => {
      ref.child('lots').child(element.key).set ({
          area: element.val().area,
          block: element.val().block,
          color: element.val().color,
          map_points: element.val().map_points,
          name: element.val().name,
          type: element.val().type,
          status: element.val().status,
          dailyRunLastUpdated: currentDate.toISOString()
      });
    });

    

  }).catch(reason => {
    res.status(200).send('lots: ' + reason);
  });


  // res.status(200).send(updates);
  // ref.update(updates)
  res.status(200).send('ok: ' + currentDate.toISOString());


});