'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
// const cors = require('cors')({ origin: true });
admin.initializeApp(functions.config().firebase);

const ref = admin.database().ref();

exports.updateBlocksMapRenderDetails = functions.https.onRequest((req, res) => {
  ref.child('blocks').once('value').then(snapshot => {
    if (snapshot.exists()) {
      getStatusColors().then(statusColors => {
        snapshot.forEach(element => {
          var mapRenderDetails = {
            stroke_color: (typeof (statusColors[element.val().type]) != 'undefined' ? statusColors[element.val().type].stroke_color : 'white'),
            bg_color: (typeof (statusColors[element.val().type]) != 'undefined' ? statusColors[element.val().type].bg_color : 'gray'),
            fore_color: (typeof (statusColors[element.val().type]) != 'undefined' ? statusColors[element.val().type].fore_color : 'white'),
            type_name: (typeof (statusColors[element.val().type]) != 'undefined' ? statusColors[element.val().type].name : '')
          };

          element.ref.update({
            partname: ('Block ' + element.val().block + ' - Part ' + element.val().block),
            maprenderdetails: mapRenderDetails,
            maprenderdetailsupdate: 2
          });

        });

        res.status(200).send('ok:' + snapshot.numChildren());

      }).catch(reason => {
        res.status(200).send('Map Render Details Updates in status color: ' + reason);
      });
    }
    else {
      res.status(200).send('Map Render Details Updates in status color: snapshot null');
    }

  }).catch(reason => {
    res.status(200).send('Map Render Details Updates: ' + reason);
  });

});

exports.updateLotsMapRenderDetails = functions.https.onRequest((req, res) => {
  ref.child('lots').once('value').then(snapshot => {
    if (snapshot.exists()) {
      getStatusColors().then(statusColors => {
        snapshot.forEach(element => {
          var mapRenderDetails = {
            designation_name: (typeof (statusColors[element.val().designation]) != 'undefined' ? statusColors[element.val().designation].name : ''),
            stroke_color: (typeof (statusColors[element.val().designation]) != 'undefined' ? statusColors[element.val().designation].stroke_color : 'white'),
            bg_color: (typeof (statusColors[element.val().status]) != 'undefined' ? statusColors[element.val().status].bg_color : 'gray'),
            fore_color: (typeof (statusColors[element.val().status]) != 'undefined' ? statusColors[element.val().status].fore_color : 'white'),
            status_name: (typeof (statusColors[element.val().status]) != 'undefined' ? statusColors[element.val().status].name : ''),
            type_name: (typeof (statusColors[element.val().type]) != 'undefined' ? statusColors[element.val().type].name : ''),
            type_bg_color: (typeof (statusColors[element.val().type]) != 'undefined' ? statusColors[element.val().type].bg_color : ''),
            type_fore_color: (typeof (statusColors[element.val().type]) != 'undefined' ? statusColors[element.val().type].fore_color : '')
          };

          element.ref.update({
            maprenderdetails: mapRenderDetails,
            maprenderdetailsupdate: 2
          });

        });

        res.status(200).send('ok:' + snapshot.numChildren());

      }).catch(reason => {
        res.status(200).send('Map Render Details Updates in status color: ' + reason);
      });

    }
    else {
      res.status(200).send('Map Render Details Updates in status color: snapshot null');
    }

  }).catch(reason => {
    res.status(200).send('Map Render Details Updates: ' + reason);
  });

});

exports.fiveminuteReset = functions.https.onRequest((req, res) => {
  // var serverDateTime = new Date(admin.database.ServerValue.TIMESTAMP);
  var d1 = new Date();
  var xdate = new Date(d1);
  var sdate = new Date(d1);
  xdate.setHours(d1.getHours() - 48); //less 24hours
  sdate.setHours(d1.getHours() + 8); //manila +8 offset from UTC

  var computedStartDateTimeNow = xdate.getFullYear() + "-" + ("0" + (xdate.getMonth() + 1)).slice(-2) + "-" + ("0" + xdate.getDate()).slice(-2)
    + "T" + ("0" + (xdate.getHours())).slice(-2) + ":" + ("0" + xdate.getMinutes()).slice(-2);

  var computedDateTimeNow = sdate.getFullYear() + "-" + ("0" + (sdate.getMonth() + 1)).slice(-2) + "-" + ("0" + sdate.getDate()).slice(-2)
    + "T" + ("0" + (sdate.getHours())).slice(-2) + ":" + ("0" + sdate.getMinutes()).slice(-2);

  ref.child('lots').orderByChild('reservationdetails/expiry').startAt(computedStartDateTimeNow).endAt(computedDateTimeNow).once('value').then(snapshot => {
    if (snapshot.exists()) {

      getStatusColors().then(statusColors => {
        if (statusColors) {
          snapshot.forEach(element => {
            if (element.val().reservationdetails.expiry) {
              getNextReservation(element.key, element.val().reservation, element.val().reservationdetails.expiry).then(tokens => {
                var updatePathsAtOnce = {};
                if (tokens) {

                  var keys = Object.keys(tokens);
                  var previousDate;
                  var key = '';

                  keys.forEach(ckey => {
                    //contain next
                    //check if next reservation is also expired
                    var kxdate = new Date(tokens[ckey].expiry);
                    if (tokens[ckey].expiry) {
                      if (kxdate > sdate) {
                        if (previousDate) {
                          if (kxdate < previousDate) {
                            //if current expiry date is greater than previous evaluated expiry
                            key = ckey;
                          }
                        }
                        else {
                          key = ckey;
                        }

                        previousDate = kxdate;
                      }
                    }
                  });

                  if (key) {
                    updatePathsAtOnce['/reservations/' + element.key + '/' + element.val().reservation + '/iscurrent'] = false;
                    updatePathsAtOnce['/reservations/' + element.key + '/' + element.val().reservation + '/isexpired'] = true;
                    updatePathsAtOnce['/reservations/' + element.key + '/' + key + '/iscurrent'] = true;
                    updatePathsAtOnce['/reservations/' + element.key + '/' + key + '/isexpired'] = false;
                    tokens[key].iscurrent = true;
                    tokens[key].isxpired = false;
                    updatePathsAtOnce['/lots/' + element.key + '/reservation'] = key.toString();
                    updatePathsAtOnce['/lots/' + element.key + '/reservationdetails'] = tokens[key];
                    updatePathsAtOnce['/lots/' + element.key + '/status'] = tokens[key].type;
                    updatePathsAtOnce['/lots/' + element.key + '/maprenderdetails/bg_color'] = statusColors[tokens[key].type].bg_color;
                    updatePathsAtOnce['/lots/' + element.key + '/maprenderdetails/fore_color'] = statusColors[tokens[key].type].fore_color;
                    updatePathsAtOnce['/lots/' + element.key + '/maprenderdetails/status_name'] = statusColors[tokens[key].type].name;
                  }
                }
                else {
                  //no next
                  updatePathsAtOnce['/reservations/' + element.key + '/' + element.val().reservation + '/iscurrent'] = false;
                  updatePathsAtOnce['/reservations/' + element.key + '/' + element.val().reservation + '/isexpired'] = true;
                  updatePathsAtOnce['/lots/' + element.key + '/reservation'] = '';
                  updatePathsAtOnce['/lots/' + element.key + '/reservationdetails'] = '';
                  updatePathsAtOnce['/lots/' + element.key + '/status'] = 'available';
                  updatePathsAtOnce['/lots/' + element.key + '/maprenderdetails/bg_color'] = statusColors['available'].bg_color;
                  updatePathsAtOnce['/lots/' + element.key + '/maprenderdetails/fore_color'] = statusColors['available'].fore_color;
                  updatePathsAtOnce['/lots/' + element.key + '/maprenderdetails/status_name'] = statusColors['available'].name;
                }

                ref.update(updatePathsAtOnce).then(function () {
                  console.log("Write completed")
                }).catch(function (error) {
                  res.status(200).send(error);
                });

              });
            }
          });

          res.status(200).send('ok:' + snapshot.numChildren());

        }
        else {
          res.status(505).send('status colors not defined');
        }

      }).catch(reason => {
        res.status(505).send('fiveminuteReset error: ' + reason);
      });
    }
    else {
      res.status(505).send('snapshot null');
    }
    // res.status(200).send('total is ' + snapshot.numChildren());
  }).catch(reason => {
    res.status(505).send('fiveminuteReset error: ' + reason);
  });
});

const getStatusColors = () => {
  return admin.database().ref('/statuscolor').once('value').then(snap => {
    return snap.val();
  });
}

const getNextReservation = (lotKey, currentReservationKey, currentServerDateTime) => {
  return admin.database().ref('/reservations/' + lotKey).orderByChild('start').startAt(currentServerDateTime).limitToFirst(2).once('value').then(snap => {
    return snap.val();
  });
}
