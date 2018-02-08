'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
// const cors = require('cors')({ origin: true });
admin.initializeApp(functions.config().firebase);

const ref = admin.database().ref();

exports.fiveminuteReset = functions.https.onRequest((req, res) => {
  // var serverDateTime = new Date(admin.database.ServerValue.TIMESTAMP);
  var d1 = new Date();
  var xdate = new Date(d1);
  var sdate = new Date(d1);
  xdate.setHours(d1.getHours() - 168); //less 24hours
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

                var map_lot = 'block' + element.val().block + 'lot' + element.val().lot;
                getMapLotStatus(map_lot, element.val().level).then(mapLotStatus => {

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

                      //if have map_lot then update map_lot
                      if (mapLotStatus) {
                        updatePathsAtOnce['/lots/' + map_lot + '/status'] = mapLotStatus;
                        updatePathsAtOnce['/lots/' + map_lot + '/maprenderdetails/bg_color'] = statusColors[mapLotStatus].bg_color;
                        updatePathsAtOnce['/lots/' + map_lot + '/maprenderdetails/fore_color'] = statusColors[mapLotStatus].fore_color;
                        updatePathsAtOnce['/lots/' + map_lot + '/maprenderdetails/status_name'] = statusColors[mapLotStatus].name;
                      }
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

                    //if have map_lot then update map_lot
                    if (mapLotStatus) {
                      updatePathsAtOnce['/lots/' + map_lot + '/status'] = mapLotStatus;
                      updatePathsAtOnce['/lots/' + map_lot + '/maprenderdetails/bg_color'] = statusColors[mapLotStatus].bg_color;
                      updatePathsAtOnce['/lots/' + map_lot + '/maprenderdetails/fore_color'] = statusColors[mapLotStatus].fore_color;
                      updatePathsAtOnce['/lots/' + map_lot + '/maprenderdetails/status_name'] = statusColors[mapLotStatus].name;
                    }

                  }

                  ref.update(updatePathsAtOnce).then(function () {
                    console.log(element.key + ": Write completed")
                  }).catch(function (error) {
                    console.log(element.key + ':' + error)
                  });

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
      res.status(200).send('snapshot null');
    }
    // res.status(200).send('total is ' + snapshot.numChildren());
  }).catch(reason => {
    res.status(505).send('fiveminuteReset error: ' + reason);
  });
});

exports.reservationReports = functions.database.ref('/lots/{uid}')
  .onWrite(event => {
    //get previous and new data
    //get server time +8
    //get ActivityReport current value
    //compare previous date if today, if not today no update to be set, if today: update the ActivityReport Current value
    //compare current date if today, if not today no update to be set, if today: update the ActivityReport Current value

    const previousData = event.data.previous.val();
    const newData = event.data.val();

    var serverDateTime = new Date();
    var serverDateTimePH = new Date(serverDateTime);
    serverDateTimePH.setHours(serverDateTime.getHours() + 8);
    var serverDatePH_String = serverDateTimePH.getFullYear() + "-" + ("0" + (serverDateTimePH.getMonth() + 1)).slice(-2) + "-" + ("0" + serverDateTimePH.getDate()).slice(-2) + "T00:00";
    var serverDatePH = new Date(serverDatePH_String);

    var updatePathsAtOnce = {};

    // admin.database().ref('/reports/lotstatus/Today').once('value').then(activityReport => {
    // }).catch(reason => {
    //   console.log('error on ActivityReport: ' + reason);
    //   return null;
    // });

    if (previousData.reservationdetails) {
      if (previousData.reservationdetails.start) {
        var previousDataStart = new Date(previousData.reservationdetails.start);
        var previousDataStart_noTimeString = previousDataStart.getFullYear() + "-" + ("0" + (previousDataStart.getMonth() + 1)).slice(-2) + "-" + ("0" + previousDataStart.getDate()).slice(-2) + "T00:00";
        var previousDataStart_noTimeDate = new Date(previousDataStart_noTimeString);
        if (serverDatePH.getTime() === previousDataStart_noTimeDate.getTime()) {
          //get ActivityReport Current Value
          var previousDataStatus = previousData.status;
          // var activityReportValue = 0;
          // if (activityReport.exists()) {
          //   var statVal = activityReport.val()[previousData.type];
          //   if (statVal) {
          //     if (previousDataStatus == 'hold' && statVal.hold) activityReportValue = statVal.hold;
          //     if (previousDataStatus == 'reserved' && statVal.reserved) activityReportValue = statVal.reserved;
          //     if (previousDataStatus == 'sold' && statVal.sold) activityReportValue = statVal.sold;
          //   }
          // }
          if (previousDataStatus) {

            if (previousDataStatus != 'notyetavailable' && previousDataStatus != 'available') {
              // updatePathsAtOnce['/reports/lotstatus/Today/' + previousData.type + '/' + previousDataStatus] = activityReportValue - 1;
              admin.database().ref('/reports/lotstatus/Today/' + previousData.type + '/' + previousDataStatus).transaction(qty => qty = qty - 1).then(() => { });
              console.log('less:ok');
            }

          }

        }
      }
    }


    if (newData.reservationdetails) {
      if (newData.reservationdetails.start) {
        var newDataStart = new Date(newData.reservationdetails.start);
        var newDataStart_noTimeString = newDataStart.getFullYear() + "-" + ("0" + (newDataStart.getMonth() + 1)).slice(-2) + "-" + ("0" + newDataStart.getDate()).slice(-2) + "T00:00";
        var newDataStart_noTimeDate = new Date(newDataStart_noTimeString);
        if (serverDatePH.getTime() === newDataStart_noTimeDate.getTime()) {
          //get ActivityReport Current Value
          var newDataStatus = newData.status;
          // var activityReportValue = 0;
          // if (activityReport.exists()) {
          //   var statVal = activityReport.val()[newData.type];
          //   if (statVal) {
          //     if (newDataStatus == 'hold' && statVal.hold) activityReportValue = statVal.hold;
          //     if (newDataStatus == 'reserved' && statVal.reserved) activityReportValue = statVal.reserved;
          //     if (newDataStatus == 'sold' && statVal.sold) activityReportValue = statVal.sold;
          //   }
          // }
          if (newDataStatus) {

            if (newDataStatus != 'notyetavailable' && newDataStatus != 'available') {
              // updatePathsAtOnce['/reports/lotstatus/Today/' + newData.type + '/' + newDataStatus] = activityReportValue + 1;
              admin.database().ref('/reports/lotstatus/Today/' + newData.type + '/' + newDataStatus).transaction(qty => qty = qty + 1).then(() => { });
              console.log('add:ok');
            }

          }

        }
      }
    }

    return null;
    // if (Object.keys(updatePathsAtOnce).length > 0) {
    //   ref.update(updatePathsAtOnce).then(function () {
    //     console.log("Write completed");
    //   }).catch(function (error) {
    //     console.log(event.params.uid + ':' + error);
    //   });
    // }
    // else {
    //   console.log("No Write completed");
    //   return null;
    // }



  });

exports.reservationReportsReset = functions.https.onRequest((req, res) => {
  var updatePathsAtOnce = {};
  updatePathsAtOnce['/reports/lotstatus/Today'] = {
    bonechamber: {
      hold: 0,
      reserved: 0,
      sold: 0
    },
    cinerarium: {
      hold: 0,
      reserved: 0,
      sold: 0
    },
    familylots1: {
      hold: 0,
      reserved: 0,
      sold: 0
    },
    familylots2: {
      hold: 0,
      reserved: 0,
      sold: 0
    },
    familylots3: {
      hold: 0,
      reserved: 0,
      sold: 0
    },
    familylots4: {
      hold: 0,
      reserved: 0,
      sold: 0
    },
    familylots5: {
      hold: 0,
      reserved: 0,
      sold: 0
    },
    gardenlots1: {
      hold: 0,
      reserved: 0,
      sold: 0
    },
    gardenlots2: {
      hold: 0,
      reserved: 0,
      sold: 0
    },
    gardenlots3: {
      hold: 0,
      reserved: 0,
      sold: 0
    },
    gardenlots4: {
      hold: 0,
      reserved: 0,
      sold: 0
    },
    gardenlots5: {
      hold: 0,
      reserved: 0,
      sold: 0
    },
    lawnlots: {
      hold: 0,
      reserved: 0,
      sold: 0
    },
    wallniche: {
      hold: 0,
      reserved: 0,
      sold: 0
    }
  };
  
  ref.update(updatePathsAtOnce).then(function () {
    res.status(200).send("Write completed");
  }).catch(function (error) {
    res.status(200).send('error');
  });


});





// exports.reservationReports_status = functions.database.ref('/lots/{uid}/status')
//   .onUpdate(event => {
//     event.data.ref.parent.once("value").then(parentValue => {

//       const prevData = event.data.previous.val();
//       const newData = event.data.val();
//       // console.log(parentValue.val());

//       var serverDateTime = new Date();
//       var serverDateTimePH = new Date(serverDateTime);
//       serverDateTimePH.setHours(serverDateTime.getHours() + 8); //manila +8 offset from UTC      

//       //remove time
//       var serverDatePH_String = serverDateTimePH.getFullYear() + "-" + ("0" + (serverDateTimePH.getMonth() + 1)).slice(-2) + "-" + ("0" + serverDateTimePH.getDate()).slice(-2) + "T00:00";
//       var serverDatePH = new Date(serverDatePH_String);

//       //get start date
//       var tempDate = new Date(parentValue.val().reservationdetails.start);
//       var tempDate_String = tempDate.getFullYear() + "-" + ("0" + (tempDate.getMonth() + 1)).slice(-2) + "-" + ("0" + tempDate.getDate()).slice(-2) + "T00:00";
//       var sDate = new Date(tempDate_String);

//       //Today
//       if (serverDatePH.getTime() === sDate.getTime()) {

//         admin.database().ref('/reports/lotstatus/Today').once('value').then(today => {

//           var prevValue_Qty = 0;
//           var currValue_Qty = 0;

//           if (today.exists()) {
//             var statVal = today.val()[parentValue.val().type];
//             if (statVal) {
//               if (prevData == 'hold' && statVal.hold) prevValue_Qty = statVal.hold;
//               if (prevData == 'reserved' && statVal.reserved) prevValue_Qty = statVal.reserved;
//               if (prevData == 'sold' && statVal.sold) prevValue_Qty = statVal.sold;

//               if (newData == 'hold' && statVal.hold) currValue_Qty = statVal.hold;
//               if (newData == 'reserved' && statVal.reserved) currValue_Qty = statVal.reserved;
//               if (newData == 'sold' && statVal.sold) currValue_Qty = statVal.sold;
//             }
//           }

//           var updatePathsAtOnce = {};
//           if (prevData != 'notyetavailable' && prevData != 'available' && prevData) updatePathsAtOnce['/reports/lotstatus/Today/' + parentValue.val().type + '/' + prevData] = prevValue_Qty - 1;
//           if (newData != 'notyetavailable' && newData != 'available' && newData) updatePathsAtOnce['/reports/lotstatus/Today/' + parentValue.val().type + '/' + newData] = currValue_Qty + 1;

//           ref.update(updatePathsAtOnce).then(function () {
//             console.log("Write completed");
//           }).catch(function (error) {
//             console.log(event.params.uid + ':' + error);
//           });

//         });

//       }
//       else {
//         return null;
//       }


//     });

//     return null;

//   });


// exports.reservationReports_start = functions.database.ref('/lots/{uid}/reservationdetails/start')
//   .onWrite(event => {
//     event.data.ref.parent.parent.once("value").then(parentValue => {

//       const prevData = event.data.previous.val();
//       const newData = event.data.val();
//       // console.log(parentValue.val());

//       admin.database().ref('/reports/lotstatus/Today').once('value').then(today => {

//         var prevValue_Qty = 0;
//         var currValue_Qty = 0;

//         if (today.exists()) {
//           var statVal = today.val()[parentValue.val().type];
//           if (statVal) {
//             if (parentValue.val().status) {
//               var sType = parentValue.val().status;
//               if (sType) {
//                 if (sType == 'hold' && statVal.hold) prevValue_Qty = statVal.hold;
//                 if (sType == 'reserved' && statVal.reserved) prevValue_Qty = statVal.reserved;
//                 if (sType == 'sold' && statVal.sold) prevValue_Qty = statVal.sold;

//                 if (sType == 'hold' && statVal.hold) currValue_Qty = statVal.hold;
//                 if (sType == 'reserved' && statVal.reserved) currValue_Qty = statVal.reserved;
//                 if (sType == 'sold' && statVal.sold) currValue_Qty = statVal.sold;
//               }
//             }
//           }
//         }

//         var serverDateTime = new Date();
//         var serverDateTimePH = new Date(serverDateTime);
//         serverDateTimePH.setHours(serverDateTime.getHours() + 8); //manila +8 offset from UTC      

//         //remove time
//         var serverDatePH_String = serverDateTimePH.getFullYear() + "-" + ("0" + (serverDateTimePH.getMonth() + 1)).slice(-2) + "-" + ("0" + serverDateTimePH.getDate()).slice(-2) + "T00:00";
//         var serverDatePH = new Date(serverDatePH_String);

//         //get prev date
//         var ptempDate = new Date(prevData);
//         var ptempDate_String = ptempDate.getFullYear() + "-" + ("0" + (ptempDate.getMonth() + 1)).slice(-2) + "-" + ("0" + ptempDate.getDate()).slice(-2) + "T00:00";
//         var psDate = new Date(ptempDate_String);

//         //get curr date
//         var ctempDate = new Date(newData);
//         var ctempDate_String = ctempDate.getFullYear() + "-" + ("0" + (ctempDate.getMonth() + 1)).slice(-2) + "-" + ("0" + ctempDate.getDate()).slice(-2) + "T00:00";
//         var csDate = new Date(ctempDate_String);

//         // console.log(prevData + ' ' + newData);

//         //Today
//         var updatePathsAtOnce = {};

//         if (serverDatePH.getTime() === psDate.getTime()) {
//           if (parentValue.val().status && parentValue.val().type) {
//             if (parentValue.val().status != 'notyetavailable' && parentValue.val().status != 'available') updatePathsAtOnce['/reports/lotstatus/Today/' + parentValue.val().type + '/' + parentValue.val().status] = prevValue_Qty - 1;
//           }
//         }

//         if (serverDatePH.getTime() === csDate.getTime()) {
//           if (parentValue.val().status && parentValue.val().type) {
//             if (parentValue.val().status != 'notyetavailable' && parentValue.val().status != 'available') updatePathsAtOnce['/reports/lotstatus/Today/' + parentValue.val().type + '/' + parentValue.val().status] = currValue_Qty + 1;
//           }
//         }

//         if (Object.keys(updatePathsAtOnce).length > 0) {

//           ref.update(updatePathsAtOnce).then(function () {
//             console.log("Write completed");
//           }).catch(function (error) {
//             console.log(event.params.uid + ':' + error);
//           });
//         }
//         else {
//           return null;
//         }

//       });

//     });

//     return null;
//   });





// exports.reservationReports = functions.database.ref('/lots/{uid}/status')
//   .onWrite(event => {
//     const prevData = event.data.previous.val();
//     const newData = event.data.val();

//     var updatePathsAtOnce = {};

//     var serverDateTime = new Date();
//     var serverDateTimePH = new Date(serverDateTime);
//     serverDateTimePH.setHours(serverDateTime.getHours() + 8); //manila +8 offset from UTC      
//     //remove time
//     var serverDatePH_String = serverDateTimePH.getFullYear() + "-" + ("0" + (serverDateTimePH.getMonth() + 1)).slice(-2) + "-" + ("0" + serverDateTimePH.getDate()).slice(-2) + "T00:00";
//     var serverDatePH = new Date(serverDatePH_String);

//     var prevDate;
//     if (prevData.reservationdetails.start) {
//       var tempDate = new Date(prevData.reservationdetails.start);
//       var tempDate_String = tempDate.getFullYear() + "-" + ("0" + (tempDate.getMonth() + 1)).slice(-2) + "-" + ("0" + tempDate.getDate()).slice(-2) + "T00:00";
//       prevDate = new Date(tempDate_String);
//     }

//     var newDate;
//     if (newData.reservationdetails.start) {
//       var tempDate = new Date(newData.reservationdetails.start);
//       var tempDate_String = tempDate.getFullYear() + "-" + ("0" + (tempDate.getMonth() + 1)).slice(-2) + "-" + ("0" + tempDate.getDate()).slice(-2) + "T00:00";
//       newDate = new Date(tempDate_String);      
//     }



//     if (prevDate) {
//       //less 1
//       //get code value

//       //Today
//       if(serverDatePH == prevDate) {

//       }
//       //Yesterday
//       //Current Week
//       //January 2018
//     }

//     if (newDate) {
//       //add 1
//       //get code value
//     }



//     // console.log(previousData);
//     // console.log(newData);

//     // event.data.ref.parent.once("value").then(snap => {
//     //get current and previous report value
//     // var d1 = new Date();
//     // var currentDateTime = new Date(d1);
//     // currentDateTime.setHours(d1.getHours() + 8); //manila +8 offset from UTC      

//     var d1 = new Date();
//     var curr = new Date(d1);
//     curr.setHours(d1.getHours() + 8); //manila +8 offset from UTC      
//     // var curr = new Date; // get current date

//     var first = curr.getDate() - curr.getDay(); // First day is the day of the month - the day of the week
//     var last = first + 6; // last day is the first day + 6

//     var firstday = new Date(curr.setDate(first)).toUTCString();
//     var lastday = new Date(curr.setDate(last)).toUTCString();

//     console.log(firstday);
//     console.log(lastday);

//     this.expiryDate = xdate.getFullYear() + "-" + ("0" + (xdate.getMonth() + 1)).slice(-2) + "-" + ("0" + xdate.getDate()).slice(-2)
//       + "T" + ("0" + xdate.getHours()).slice(-2) + ":" + ("0" + xdate.getMinutes()).slice(-2);

//     // console.log(d1.toISOString());
//     // console.log(currentDateTime.toISOString());
//     // console.log(snap.val());

//     // if(snap.val().reservationdetails.start) {

//     // }

//     //Today
//     //Yesterday
//     //Current Week
//     //January 2018


//     // admin.database().ref('/reports/lotstatus/' + currentDateTime.toISOString() + '/' + previousData).once('value').then(prevVal => {
//     //   var reportPreviousValue = Number(prevVal.val());

//     //   admin.database().ref('/reports/lotstatus/' + currentDateTime.toISOString() + '/' + newData).once('value').then(currVal => {
//     //     var reportCurrentValue = Number(currVal.val());

//     //     var updatePathsAtOnce = {};
//     //     updatePathsAtOnce['/reports/lotstatus/' + currentDateTime.toISOString() + '/' + previousData] = reportPreviousValue - 1;
//     //     updatePathsAtOnce['/reports/lotstatus/' + currentDateTime.toISOString() + '/' + newData] = reportCurrentValue + 1;

//     //     ref.update(updatePathsAtOnce).then(function () {
//     //       console.log("Write completed");
//     //     }).catch(function (error) {
//     //       console.log(event.params.uid + ':' + error);
//     //     });


//     //   });

//     // });


//     // })

//     return null;

//   });



const getStatusColors = () => {
  return admin.database().ref('/statuscolor').once('value').then(snap => {
    return snap.val();
  });
}

const getNextReservation = (lotKey, currentReservationKey, currentServerDateTime) => {
  return admin.database().ref('/reservations/' + lotKey).orderByChild('start').startAt(currentServerDateTime).limitToFirst(2).once('value').then(snap => {
    return snap.val();
    //SHB note: will check later if the ff will matter:
    //01/01/2018 - Hold Expires
    //01/10/2018 - Reservation Starts
    //01/02 - 09,2018 - Available --- also as current date = 01/03/2018
  });
}

const getMapLotStatus = (mapLot, level) => {
  if (level) {
    return admin.database().ref('/lots').orderByKey('map_lot').equalTo(mapLot).limitToFirst(5).once('value').then(snap => {
      if (snap.exists()) {
        var winningValStat = 0;
        snap.forEach(element => {
          var valStat = 0;
          var stat = element.val().status;
          if (stat) {
            if (stat === 'available') valStat = 5;
            else if (stat === 'hold') valStat = 4;
            else if (stat === 'reserved') valStat = 3;
            else if (stat === 'soldlacking') valStat = 2;
            else if (stat === 'sold') valStat = 1;
            else valStat = 0; //notyetavailable
          }
          if (valStat > winningValStat) {
            winningValStat = valStat;
          }
        });

        if (winningValStat == 5) return Promise.resolve('available');
        else if (winningValStat == 4) return Promise.resolve('hold');
        else if (winningValStat == 3) return Promise.resolve('reserved');
        else if (winningValStat == 2) return Promise.resolve('soldlacking');
        else if (winningValStat == 1) return Promise.resolve('sold');
        else return Promise.resolve('notyetavailable');

      }
      else {
        return Promise.resolve('notyetavailable');
      }
    }).catch(function (error) {
      return Promise.resolve('notyetavailable');
    });
  }
  else {
    return Promise.resolve(null);
  }


}


// exports.updateLotStatusToNotYetAvailable = functions.https.onRequest((req, res) => {
//   ref.child('lots').orderByChild('block').equalTo('57').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().status === 'available') {
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/status'] = 'notyetavailable';
//             myupdate['/lots/' + element.key + '/maprenderdetails/bg_color'] = (typeof (statusColors['notyetavailable']) != 'undefined' ? statusColors['notyetavailable'].bg_color : 'gray');
//             myupdate['/lots/' + element.key + '/maprenderdetails/fore_color'] = (typeof (statusColors['notyetavailable']) != 'undefined' ? statusColors['notyetavailable'].fore_color : 'white');
//             myupdate['/lots/' + element.key + '/maprenderdetails/status_name'] = (typeof (statusColors['notyetavailable']) != 'undefined' ? statusColors['notyetavailable'].name : '');

//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }

//         });

//         res.status(200).send('ok:' + snapshot.numChildren());

//       }).catch(reason => {
//         res.status(200).send('updateLotStatusToNotYetAvailable: ' + reason);
//       });

//     }
//     else {
//       // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//       console.log('updateLotStatusToNotYetAvailable, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('updateLotStatusToNotYetAvailable: ' + reason);
//   });
// });



// 58,59,60,61,62,63,64,65
// exports.updateWallNicheDesignation5861 = functions.https.onRequest((req, res) => {
//   ref.child('lots').orderByChild('block').equalTo('58').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       // getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().level === 'a' || element.val().level === 'b') { //premium
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/designation'] = 'premium';
//             myupdate['/lots/' + element.key + '/maprenderdetails/designation_name'] = 'Premium';
//             myupdate['/lots/' + element.key + '/maprenderdetails/stroke_color'] = '#000000';
            
//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }
//           else if (element.val().level === 'c' || element.val().level === 'd') { //special
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/designation'] = 'regular';
//             myupdate['/lots/' + element.key + '/maprenderdetails/designation_name'] = 'Regular';
//             myupdate['/lots/' + element.key + '/maprenderdetails/stroke_color'] = '#F5F5F5';
            
//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }          

//         });

//         // res.status(200).send('ok:' + snapshot.numChildren());

//       // }).catch(reason => {
//       //   res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       // });

//     }
//     else {
//       // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//       console.log('Map 57, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });

//   ref.child('lots').orderByChild('block').equalTo('59').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       // getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().level === 'a' || element.val().level === 'b') { //premium
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/designation'] = 'premium';
//             myupdate['/lots/' + element.key + '/maprenderdetails/designation_name'] = 'Premium';
//             myupdate['/lots/' + element.key + '/maprenderdetails/stroke_color'] = '#000000';
            
//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }
//           else if (element.val().level === 'c' || element.val().level === 'd') { //special
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/designation'] = 'regular';
//             myupdate['/lots/' + element.key + '/maprenderdetails/designation_name'] = 'Regular';
//             myupdate['/lots/' + element.key + '/maprenderdetails/stroke_color'] = '#F5F5F5';
            
//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }          

//         });

//         // res.status(200).send('ok:' + snapshot.numChildren());

//       // }).catch(reason => {
//       //   res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       // });

//     }
//     else {
//       // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//       console.log('Map 57, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });

//   ref.child('lots').orderByChild('block').equalTo('60').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       // getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().level === 'a' || element.val().level === 'b') { //premium
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/designation'] = 'premium';
//             myupdate['/lots/' + element.key + '/maprenderdetails/designation_name'] = 'Premium';
//             myupdate['/lots/' + element.key + '/maprenderdetails/stroke_color'] = '#000000';
            
//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }
//           else if (element.val().level === 'c' || element.val().level === 'd') { //special
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/designation'] = 'regular';
//             myupdate['/lots/' + element.key + '/maprenderdetails/designation_name'] = 'Regular';
//             myupdate['/lots/' + element.key + '/maprenderdetails/stroke_color'] = '#F5F5F5';
            
//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }          

//         });

//         // res.status(200).send('ok:' + snapshot.numChildren());

//       // }).catch(reason => {
//       //   res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       // });

//     }
//     else {
//       // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//       console.log('Map 57, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });  

//   ref.child('lots').orderByChild('block').equalTo('61').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       // getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().level === 'a' || element.val().level === 'b') { //premium
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/designation'] = 'premium';
//             myupdate['/lots/' + element.key + '/maprenderdetails/designation_name'] = 'Premium';
//             myupdate['/lots/' + element.key + '/maprenderdetails/stroke_color'] = '#000000';
            
//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }
//           else if (element.val().level === 'c' || element.val().level === 'd') { //special
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/designation'] = 'regular';
//             myupdate['/lots/' + element.key + '/maprenderdetails/designation_name'] = 'Regular';
//             myupdate['/lots/' + element.key + '/maprenderdetails/stroke_color'] = '#F5F5F5';
            
//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }          

//         });

//         res.status(200).send('ok:');
//         // res.status(200).send('ok:' + snapshot.numChildren());

//       // }).catch(reason => {
//       //   res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       // });

//     }
//     else {
//       // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//       console.log('Map 57, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });  

 

// });

// exports.updateWallNicheDesignation6265 = functions.https.onRequest((req, res) => {
//   ref.child('lots').orderByChild('block').equalTo('62').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       // getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().level === 'a' || element.val().level === 'b') { //premium
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/designation'] = 'premium';
//             myupdate['/lots/' + element.key + '/maprenderdetails/designation_name'] = 'Premium';
//             myupdate['/lots/' + element.key + '/maprenderdetails/stroke_color'] = '#000000';
            
//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }
//           else if (element.val().level === 'c' || element.val().level === 'd') { //special
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/designation'] = 'regular';
//             myupdate['/lots/' + element.key + '/maprenderdetails/designation_name'] = 'Regular';
//             myupdate['/lots/' + element.key + '/maprenderdetails/stroke_color'] = '#F5F5F5';
            
//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }          

//         });

//         // res.status(200).send('ok:' + snapshot.numChildren());

//       // }).catch(reason => {
//       //   res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       // });

//     }
//     else {
//       // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//       console.log('Map 57, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });  

//   ref.child('lots').orderByChild('block').equalTo('63').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       // getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().level === 'a' || element.val().level === 'b') { //premium
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/designation'] = 'premium';
//             myupdate['/lots/' + element.key + '/maprenderdetails/designation_name'] = 'Premium';
//             myupdate['/lots/' + element.key + '/maprenderdetails/stroke_color'] = '#000000';
            
//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }
//           else if (element.val().level === 'c' || element.val().level === 'd') { //special
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/designation'] = 'regular';
//             myupdate['/lots/' + element.key + '/maprenderdetails/designation_name'] = 'Regular';
//             myupdate['/lots/' + element.key + '/maprenderdetails/stroke_color'] = '#F5F5F5';
            
//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }          

//         });

//         // res.status(200).send('ok:' + snapshot.numChildren());

//       // }).catch(reason => {
//       //   res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       // });

//     }
//     else {
//       // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//       console.log('Map 57, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   }); 
  
//   ref.child('lots').orderByChild('block').equalTo('64').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       // getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().level === 'a' || element.val().level === 'b') { //premium
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/designation'] = 'premium';
//             myupdate['/lots/' + element.key + '/maprenderdetails/designation_name'] = 'Premium';
//             myupdate['/lots/' + element.key + '/maprenderdetails/stroke_color'] = '#000000';
            
//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }
//           else if (element.val().level === 'c' || element.val().level === 'd') { //special
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/designation'] = 'regular';
//             myupdate['/lots/' + element.key + '/maprenderdetails/designation_name'] = 'Regular';
//             myupdate['/lots/' + element.key + '/maprenderdetails/stroke_color'] = '#F5F5F5';
            
//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }          

//         });

//         // res.status(200).send('ok:' + snapshot.numChildren());

//       // }).catch(reason => {
//       //   res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       // });

//     }
//     else {
//       // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//       console.log('Map 57, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });  

//   ref.child('lots').orderByChild('block').equalTo('65').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       // getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().level === 'a' || element.val().level === 'b') { //premium
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/designation'] = 'premium';
//             myupdate['/lots/' + element.key + '/maprenderdetails/designation_name'] = 'Premium';
//             myupdate['/lots/' + element.key + '/maprenderdetails/stroke_color'] = '#000000';
            
//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }
//           else if (element.val().level === 'c' || element.val().level === 'd') { //special
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/designation'] = 'regular';
//             myupdate['/lots/' + element.key + '/maprenderdetails/designation_name'] = 'Regular';
//             myupdate['/lots/' + element.key + '/maprenderdetails/stroke_color'] = '#F5F5F5';
            
//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }          

//         });

//         res.status(200).send('ok:');
//         // res.status(200).send('ok:' + snapshot.numChildren());

//       // }).catch(reason => {
//       //   res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       // });

//     }
//     else {
//       // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//       console.log('Map 57, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });  

  

// });

// exports.updateBlockToAvailable = functions.https.onRequest((req, res) => {
//   ref.child('lots').orderByChild('block').equalTo('57').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().status === 'notyetavailable') {
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/status'] = 'available';
//             myupdate['/lots/' + element.key + '/maprenderdetails/bg_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].bg_color : 'gray');
//             myupdate['/lots/' + element.key + '/maprenderdetails/fore_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].fore_color : 'white');
//             myupdate['/lots/' + element.key + '/maprenderdetails/status_name'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].name : '');

//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }

//         });

//         res.status(200).send('ok:' + snapshot.numChildren());

//       }).catch(reason => {
//         res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       });

//     }
//     else {
//       // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//       console.log('Map 57, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });
// });


// exports.updateBlocksMapRenderDetails = functions.https.onRequest((req, res) => {
//   ref.child('blocks').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           var mapRenderDetails = {
//             stroke_color: (typeof (statusColors[element.val().type]) != 'undefined' ? statusColors[element.val().type].stroke_color : 'white'),
//             bg_color: (typeof (statusColors[element.val().type]) != 'undefined' ? statusColors[element.val().type].bg_color : 'gray'),
//             fore_color: (typeof (statusColors[element.val().type]) != 'undefined' ? statusColors[element.val().type].fore_color : 'white'),
//             type_name: (typeof (statusColors[element.val().type]) != 'undefined' ? statusColors[element.val().type].name : '')
//           };

//           element.ref.update({
//             partname: ('Block ' + element.val().block + ' - Part ' + element.val().block),
//             maprenderdetails: mapRenderDetails,
//             maprenderdetailsupdate: 2
//           });

//         });

//         res.status(200).send('ok:' + snapshot.numChildren());

//       }).catch(reason => {
//         res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       });
//     }
//     else {
//       res.status(200).send('Map Render Details Updates in status color: snapshot null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });

// });

// exports.updateLotsMapRenderDetails = functions.https.onRequest((req, res) => {
//   ref.child('lots').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           var mapRenderDetails = {
//             designation_name: (typeof (statusColors[element.val().designation]) != 'undefined' ? statusColors[element.val().designation].name : ''),
//             stroke_color: (typeof (statusColors[element.val().designation]) != 'undefined' ? statusColors[element.val().designation].stroke_color : 'white'),
//             bg_color: (typeof (statusColors[element.val().status]) != 'undefined' ? statusColors[element.val().status].bg_color : 'gray'),
//             fore_color: (typeof (statusColors[element.val().status]) != 'undefined' ? statusColors[element.val().status].fore_color : 'white'),
//             status_name: (typeof (statusColors[element.val().status]) != 'undefined' ? statusColors[element.val().status].name : ''),
//             type_name: (typeof (statusColors[element.val().type]) != 'undefined' ? statusColors[element.val().type].name : ''),
//             type_bg_color: (typeof (statusColors[element.val().type]) != 'undefined' ? statusColors[element.val().type].bg_color : ''),
//             type_fore_color: (typeof (statusColors[element.val().type]) != 'undefined' ? statusColors[element.val().type].fore_color : '')
//           };

//           element.ref.update({
//             maprenderdetails: mapRenderDetails,
//             maprenderdetailsupdate: 2
//           });

//         });

//         res.status(200).send('ok:' + snapshot.numChildren());

//       }).catch(reason => {
//         res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       });

//     }
//     else {
//       res.status(200).send('Map Render Details Updates in status color: snapshot null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });

// });



// exports.updateBlockToAvailable = functions.https.onRequest((req, res) => {
//   ref.child('lots').orderByChild('block').equalTo('16').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().status === 'notyetavailable') {
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/status'] = 'available';
//             myupdate['/lots/' + element.key + '/maprenderdetails/bg_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].bg_color : 'gray');
//             myupdate['/lots/' + element.key + '/maprenderdetails/fore_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].fore_color : 'white');
//             myupdate['/lots/' + element.key + '/maprenderdetails/status_name'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].name : '');

//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }

//         });

//         res.status(200).send('ok:' + snapshot.numChildren());

//       }).catch(reason => {
//         res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       });

//     }
//     else {
//       // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//       console.log('Map 16, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });

//   ref.child('lots').orderByChild('block').equalTo('17').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().status === 'notyetavailable') {
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/status'] = 'available';
//             myupdate['/lots/' + element.key + '/maprenderdetails/bg_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].bg_color : 'gray');
//             myupdate['/lots/' + element.key + '/maprenderdetails/fore_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].fore_color : 'white');
//             myupdate['/lots/' + element.key + '/maprenderdetails/status_name'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].name : '');

//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }

//         });

//         res.status(200).send('ok:' + snapshot.numChildren());

//       }).catch(reason => {
//         res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       });

//     }
//     else {
//       // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//       console.log('Map 17, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });

//   ref.child('lots').orderByChild('block').equalTo('18').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().status === 'notyetavailable') {
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/status'] = 'available';
//             myupdate['/lots/' + element.key + '/maprenderdetails/bg_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].bg_color : 'gray');
//             myupdate['/lots/' + element.key + '/maprenderdetails/fore_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].fore_color : 'white');
//             myupdate['/lots/' + element.key + '/maprenderdetails/status_name'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].name : '');

//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }

//         });

//         res.status(200).send('ok:' + snapshot.numChildren());

//       }).catch(reason => {
//         res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       });

//     }
//     else {
//       // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//       console.log('Map 18, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });

//   ref.child('lots').orderByChild('block').equalTo('19').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().status === 'notyetavailable') {
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/status'] = 'available';
//             myupdate['/lots/' + element.key + '/maprenderdetails/bg_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].bg_color : 'gray');
//             myupdate['/lots/' + element.key + '/maprenderdetails/fore_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].fore_color : 'white');
//             myupdate['/lots/' + element.key + '/maprenderdetails/status_name'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].name : '');

//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }

//         });

//         res.status(200).send('ok:' + snapshot.numChildren());

//       }).catch(reason => {
//         res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       });

//     }
//     else {
//       // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//       console.log('Map 19, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });

//   ref.child('lots').orderByChild('block').equalTo('20').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().status === 'notyetavailable') {
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/status'] = 'available';
//             myupdate['/lots/' + element.key + '/maprenderdetails/bg_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].bg_color : 'gray');
//             myupdate['/lots/' + element.key + '/maprenderdetails/fore_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].fore_color : 'white');
//             myupdate['/lots/' + element.key + '/maprenderdetails/status_name'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].name : '');

//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }

//         });

//         res.status(200).send('ok:' + snapshot.numChildren());

//       }).catch(reason => {
//         res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       });

//     }
//     else {
//       // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//       console.log('Map 20, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });

//   ref.child('lots').orderByChild('block').equalTo('21').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().status === 'notyetavailable') {
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/status'] = 'available';
//             myupdate['/lots/' + element.key + '/maprenderdetails/bg_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].bg_color : 'gray');
//             myupdate['/lots/' + element.key + '/maprenderdetails/fore_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].fore_color : 'white');
//             myupdate['/lots/' + element.key + '/maprenderdetails/status_name'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].name : '');

//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }

//         });

//         res.status(200).send('ok:' + snapshot.numChildren());

//       }).catch(reason => {
//         res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       });

//     }
//     else {
//       // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//       console.log('Map 21, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });

//   ref.child('lots').orderByChild('block').equalTo('22').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().status === 'notyetavailable') {
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/status'] = 'available';
//             myupdate['/lots/' + element.key + '/maprenderdetails/bg_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].bg_color : 'gray');
//             myupdate['/lots/' + element.key + '/maprenderdetails/fore_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].fore_color : 'white');
//             myupdate['/lots/' + element.key + '/maprenderdetails/status_name'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].name : '');

//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }

//         });

//         res.status(200).send('ok:' + snapshot.numChildren());

//       }).catch(reason => {
//         res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       });

//     }
//     else {
//       // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//       console.log('Map 22, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });

//   ref.child('lots').orderByChild('block').equalTo('23').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().status === 'notyetavailable') {
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/status'] = 'available';
//             myupdate['/lots/' + element.key + '/maprenderdetails/bg_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].bg_color : 'gray');
//             myupdate['/lots/' + element.key + '/maprenderdetails/fore_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].fore_color : 'white');
//             myupdate['/lots/' + element.key + '/maprenderdetails/status_name'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].name : '');

//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }

//         });

//         res.status(200).send('ok:' + snapshot.numChildren());

//       }).catch(reason => {
//         res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       });

//     }
//     else {
//       // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//       console.log('Map 23, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });

//   ref.child('lots').orderByChild('block').equalTo('24').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().status === 'notyetavailable') {
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/status'] = 'available';
//             myupdate['/lots/' + element.key + '/maprenderdetails/bg_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].bg_color : 'gray');
//             myupdate['/lots/' + element.key + '/maprenderdetails/fore_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].fore_color : 'white');
//             myupdate['/lots/' + element.key + '/maprenderdetails/status_name'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].name : '');

//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }

//         });

//         res.status(200).send('ok:' + snapshot.numChildren());

//       }).catch(reason => {
//         res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       });

//     }
//     else {
//       // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//       console.log('Map 24, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });

//   ref.child('lots').orderByChild('block').equalTo('36').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().status === 'notyetavailable') {
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/status'] = 'available';
//             myupdate['/lots/' + element.key + '/maprenderdetails/bg_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].bg_color : 'gray');
//             myupdate['/lots/' + element.key + '/maprenderdetails/fore_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].fore_color : 'white');
//             myupdate['/lots/' + element.key + '/maprenderdetails/status_name'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].name : '');

//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }

//         });

//         res.status(200).send('ok:' + snapshot.numChildren());

//       }).catch(reason => {
//         res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       });

//     }
//     else {
//       // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//       console.log('Map 36, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });

//   ref.child('lots').orderByChild('block').equalTo('37').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().status === 'notyetavailable') {
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/status'] = 'available';
//             myupdate['/lots/' + element.key + '/maprenderdetails/bg_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].bg_color : 'gray');
//             myupdate['/lots/' + element.key + '/maprenderdetails/fore_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].fore_color : 'white');
//             myupdate['/lots/' + element.key + '/maprenderdetails/status_name'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].name : '');

//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }

//         });

//         res.status(200).send('ok:' + snapshot.numChildren());

//       }).catch(reason => {
//         res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       });

//     }
//     else {
//       // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//       console.log('Map 37, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });

//   ref.child('lots').orderByChild('block').equalTo('38').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().status === 'notyetavailable') {
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/status'] = 'available';
//             myupdate['/lots/' + element.key + '/maprenderdetails/bg_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].bg_color : 'gray');
//             myupdate['/lots/' + element.key + '/maprenderdetails/fore_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].fore_color : 'white');
//             myupdate['/lots/' + element.key + '/maprenderdetails/status_name'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].name : '');

//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }

//         });

//         res.status(200).send('ok:' + snapshot.numChildren());

//       }).catch(reason => {
//         res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       });

//     }
//     else {
//       // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//       console.log('Map 38, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });

//   ref.child('lots').orderByChild('block').equalTo('39').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().status === 'notyetavailable') {
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/status'] = 'available';
//             myupdate['/lots/' + element.key + '/maprenderdetails/bg_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].bg_color : 'gray');
//             myupdate['/lots/' + element.key + '/maprenderdetails/fore_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].fore_color : 'white');
//             myupdate['/lots/' + element.key + '/maprenderdetails/status_name'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].name : '');

//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }

//         });

//         res.status(200).send('ok:' + snapshot.numChildren());

//       }).catch(reason => {
//         res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       });

//     }
//     else {
//       // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//       console.log('Map 39, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });

//   ref.child('lots').orderByChild('block').equalTo('40').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().status === 'notyetavailable') {
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/status'] = 'available';
//             myupdate['/lots/' + element.key + '/maprenderdetails/bg_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].bg_color : 'gray');
//             myupdate['/lots/' + element.key + '/maprenderdetails/fore_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].fore_color : 'white');
//             myupdate['/lots/' + element.key + '/maprenderdetails/status_name'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].name : '');

//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }

//         });

//         res.status(200).send('ok:' + snapshot.numChildren());

//       }).catch(reason => {
//         res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       });

//     }
//     else {
//       // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//       console.log('Map 40, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });

//   ref.child('lots').orderByChild('block').equalTo('41').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().status === 'notyetavailable') {
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/status'] = 'available';
//             myupdate['/lots/' + element.key + '/maprenderdetails/bg_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].bg_color : 'gray');
//             myupdate['/lots/' + element.key + '/maprenderdetails/fore_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].fore_color : 'white');
//             myupdate['/lots/' + element.key + '/maprenderdetails/status_name'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].name : '');

//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }

//         });

//         res.status(200).send('ok:' + snapshot.numChildren());

//       }).catch(reason => {
//         res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       });

//     }
//     else {
//       // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//       console.log('Map 41, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });

//   ref.child('lots').orderByChild('block').equalTo('53').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().status === 'notyetavailable') {
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/status'] = 'available';
//             myupdate['/lots/' + element.key + '/maprenderdetails/bg_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].bg_color : 'gray');
//             myupdate['/lots/' + element.key + '/maprenderdetails/fore_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].fore_color : 'white');
//             myupdate['/lots/' + element.key + '/maprenderdetails/status_name'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].name : '');

//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }

//         });

//         res.status(200).send('ok:' + snapshot.numChildren());

//       }).catch(reason => {
//         res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       });

//     }
//     else {
//       // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//       console.log('Map 53, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });

//   ref.child('lots').orderByChild('block').equalTo('54').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().status === 'notyetavailable') {
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/status'] = 'available';
//             myupdate['/lots/' + element.key + '/maprenderdetails/bg_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].bg_color : 'gray');
//             myupdate['/lots/' + element.key + '/maprenderdetails/fore_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].fore_color : 'white');
//             myupdate['/lots/' + element.key + '/maprenderdetails/status_name'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].name : '');

//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }

//         });

//         res.status(200).send('ok:' + snapshot.numChildren());

//       }).catch(reason => {
//         res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       });

//     }
//     else {
//       // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//       console.log('Map 54, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });

// });

// exports.updateBlock63and66ToAvailable = functions.https.onRequest((req, res) => {
//   ref.child('lots').orderByChild('block').equalTo('63').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().status === 'notyetavailable') {
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/status'] = 'available';
//             myupdate['/lots/' + element.key + '/maprenderdetails/bg_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].bg_color : 'gray');
//             myupdate['/lots/' + element.key + '/maprenderdetails/fore_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].fore_color : 'white');
//             myupdate['/lots/' + element.key + '/maprenderdetails/status_name'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].name : '');

//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }

//         });

//         res.status(200).send('ok:' + snapshot.numChildren());

//       }).catch(reason => {
//         res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       });

//     }
//     else {
//       // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//       console.log('Map 16, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });

//   ref.child('lots').orderByChild('block').equalTo('66').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().status === 'notyetavailable') {
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/status'] = 'available';
//             myupdate['/lots/' + element.key + '/maprenderdetails/bg_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].bg_color : 'gray');
//             myupdate['/lots/' + element.key + '/maprenderdetails/fore_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].fore_color : 'white');
//             myupdate['/lots/' + element.key + '/maprenderdetails/status_name'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].name : '');

//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }

//         });

//         res.status(200).send('ok:' + snapshot.numChildren());

//       }).catch(reason => {
//         res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       });

//     }
//     else {
//       // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//       console.log('Map 17, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });



// });

// exports.updateLevelDesignation = functions.https.onRequest((req, res) => {
//   ref.child('blocks').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       // getStatusColors().then(statusColors => {
//       snapshot.forEach(element => {

//         var blockNum = Number(element.val().block);
//         if (blockNum != 2 && blockNum != 16 && blockNum != 17 && blockNum != 18 && blockNum != 19
//           && blockNum != 20 && blockNum != 21 && blockNum != 22 && blockNum != 23 && blockNum != 24
//           && blockNum != 36 && blockNum != 37 && blockNum != 38 && blockNum != 39 && blockNum != 40
//           && blockNum != 41 && blockNum != 53 && blockNum != 54 && blockNum != 63 && blockNum != 66) {
//           var myupdate = {};
//           myupdate['/blocks/' + element.key + '/maprenderdetails/bg_color'] = 'gray';

//           ref.update(myupdate).then(function () {
//             console.log("Write completed")
//           }).catch(function (error) {
//             console.log(error)
//           });
//         }

//         if(blockNum === 63 && Number(element.val().part) != 3 && Number(element.val().part) != 4) {
//           var myupdate = {};
//           myupdate['/blocks/' + element.key + '/maprenderdetails/bg_color'] = 'gray';

//           ref.update(myupdate).then(function () {
//             console.log("Write completed")
//           }).catch(function (error) {
//             console.log(error)
//           });
//         }

//         if(blockNum === 66 && Number(element.val().part) != 3 && Number(element.val().part) != 4) {
//           var myupdate = {};
//           myupdate['/blocks/' + element.key + '/maprenderdetails/bg_color'] = 'gray';

//           ref.update(myupdate).then(function () {
//             console.log("Write completed")
//           }).catch(function (error) {
//             console.log(error)
//           });
//         }        


//       });

//       res.status(200).send('ok:' + snapshot.numChildren());

//       // }).catch(reason => {
//       //   res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       // });

//     }
//     else {
//       // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//       console.log('Map 16, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });

// });



// ref.child('lots').orderByChild('type').equalTo('bonechamber').once('value').then(snapshot => {
//   if (snapshot.exists()) {
//     // getStatusColors().then(statusColors => {
//     snapshot.forEach(element => {
//       if (element.val().block === '66') {
//         var lotNum = Number(element.val().lot);
//         if (lotNum >= 579 && lotNum <= 782) {
//           //nothing
//         }
//         else {
//           var myupdate = {};
//           myupdate['/lots/' + element.key + '/status'] = 'notyetavailable';
//           myupdate['/lots/' + element.key + '/maprenderdetails/bg_color'] = 'gray';
//           myupdate['/lots/' + element.key + '/maprenderdetails/fore_color'] = 'white';
//           myupdate['/lots/' + element.key + '/maprenderdetails/status_name'] = 'Not yet available';

//           ref.update(myupdate).then(function () {
//             console.log("Write completed")
//           }).catch(function (error) {
//             console.log(error)
//           });
//         }
//       }

//     });

//     res.status(200).send('ok:' + snapshot.numChildren());

//     // }).catch(reason => {
//     //   res.status(200).send('Map Render Details Updates in status color: ' + reason);
//     // });

//   }
//   else {
//     // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//     console.log('Map 16, null');
//   }

// }).catch(reason => {
//   res.status(200).send('Map Render Details Updates: ' + reason);
// });

//   ref.child('lots').orderByChild('block').equalTo('63').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().status === 'notyetavailable') {
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/status'] = 'available';
//             myupdate['/lots/' + element.key + '/maprenderdetails/bg_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].bg_color : 'gray');
//             myupdate['/lots/' + element.key + '/maprenderdetails/fore_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].fore_color : 'white');
//             myupdate['/lots/' + element.key + '/maprenderdetails/status_name'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].name : '');

//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }

//         });

//         res.status(200).send('ok:' + snapshot.numChildren());

//       }).catch(reason => {
//         res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       });

//     }
//     else {
//       // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//       console.log('Map 16, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });

//   ref.child('lots').orderByChild('block').equalTo('66').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().status === 'notyetavailable') {
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/status'] = 'available';
//             myupdate['/lots/' + element.key + '/maprenderdetails/bg_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].bg_color : 'gray');
//             myupdate['/lots/' + element.key + '/maprenderdetails/fore_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].fore_color : 'white');
//             myupdate['/lots/' + element.key + '/maprenderdetails/status_name'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].name : '');

//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }

//         });

//         res.status(200).send('ok:' + snapshot.numChildren());

//       }).catch(reason => {
//         res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       });

//     }
//     else {
//       // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//       console.log('Map 17, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });



// });

// exports.updateLevelDesignation = functions.https.onRequest((req, res) => {
//   ref.child('lots').orderByChild('type').equalTo('wallniche').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       // getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().block === '63') {
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/status'] = 'available';
//             myupdate['/lots/' + element.key + '/maprenderdetails/bg_color'] = 'green';
//             myupdate['/lots/' + element.key + '/maprenderdetails/fore_color'] = 'white';
//             myupdate['/lots/' + element.key + '/maprenderdetails/status_name'] ='Available';

//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }

//         });

//         res.status(200).send('ok:' + snapshot.numChildren());

//       // }).catch(reason => {
//       //   res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       // });

//     }
//     else {
//       // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//       console.log('Map 16, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });


// ref.child('lots').orderByChild('type').equalTo('cinerarium').once('value').then(snapshot => {
//   if (snapshot.exists()) {
//     // getStatusColors().then(statusColors => {
//       snapshot.forEach(element => {
//         // if (element.val().block != '66') {
//           var myupdate = {};
//           myupdate['/lots/' + element.key + '/status'] = 'notyetavailable';
//           myupdate['/lots/' + element.key + '/maprenderdetails/bg_color'] = 'gray';
//           myupdate['/lots/' + element.key + '/maprenderdetails/fore_color'] = 'white';
//           myupdate['/lots/' + element.key + '/maprenderdetails/status_name'] ='Not yet available';

//           ref.update(myupdate).then(function () {
//             console.log("Write completed")
//           }).catch(function (error) {
//             console.log(error)
//           });
//         // }

//       });

//       res.status(200).send('ok:' + snapshot.numChildren());

//     // }).catch(reason => {
//     //   res.status(200).send('Map Render Details Updates in status color: ' + reason);
//     // });

//   }
//   else {
//     // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//     console.log('Map 16, null');
//   }

// }).catch(reason => {
//   res.status(200).send('Map Render Details Updates: ' + reason);
// });

// ref.child('lots').orderByChild('type').equalTo('bonechamber').once('value').then(snapshot => {
//   if (snapshot.exists()) {
//     // getStatusColors().then(statusColors => {
//       snapshot.forEach(element => {
//         if (element.val().block != '66') {
//           var myupdate = {};
//           myupdate['/lots/' + element.key + '/status'] = 'notyetavailable';
//           myupdate['/lots/' + element.key + '/maprenderdetails/bg_color'] = 'gray';
//           myupdate['/lots/' + element.key + '/maprenderdetails/fore_color'] = 'white';
//           myupdate['/lots/' + element.key + '/maprenderdetails/status_name'] ='Not yet available';

//           ref.update(myupdate).then(function () {
//             console.log("Write completed")
//           }).catch(function (error) {
//             console.log(error)
//           });
//         }

//       });

//       res.status(200).send('ok:' + snapshot.numChildren());

//     // }).catch(reason => {
//     //   res.status(200).send('Map Render Details Updates in status color: ' + reason);
//     // });

//   }
//   else {
//     // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//     console.log('Map 16, null');
//   }

// }).catch(reason => {
//   res.status(200).send('Map Render Details Updates: ' + reason);
// });


// ref.child('lots').orderByChild('type').equalTo('wallniche').once('value').then(snapshot => {
//   if (snapshot.exists()) {
//     // getStatusColors().then(statusColors => {
//       snapshot.forEach(element => {
//         if (element.val().block != '63') {
//           var myupdate = {};
//           myupdate['/lots/' + element.key + '/status'] = 'notyetavailable';
//           myupdate['/lots/' + element.key + '/maprenderdetails/bg_color'] = 'gray';
//           myupdate['/lots/' + element.key + '/maprenderdetails/fore_color'] = 'white';
//           myupdate['/lots/' + element.key + '/maprenderdetails/status_name'] ='Not yet available';

//           ref.update(myupdate).then(function () {
//             console.log("Write completed")
//           }).catch(function (error) {
//             console.log(error)
//           });
//         }

//       });

//       res.status(200).send('ok:' + snapshot.numChildren());

//     // }).catch(reason => {
//     //   res.status(200).send('Map Render Details Updates in status color: ' + reason);
//     // });

//   }
//   else {
//     // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//     console.log('Map 16, null');
//   }

// }).catch(reason => {
//   res.status(200).send('Map Render Details Updates: ' + reason);
// });


// ref.child('lots').orderByChild('type').equalTo('wallniche').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       // getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().level === '') {
//             var myupdate = {};
//             myupdate['/lots/' + element.key + '/designation'] = '';
//             myupdate['/lots/' + element.key + '/maprenderdetails/designation_name'] = '';
//             myupdate['/lots/' + element.key + '/maprenderdetails/stroke_color'] = '#F5F5F5';

//             ref.update(myupdate).then(function () {
//               console.log("Write completed")
//             }).catch(function (error) {
//               console.log(error)
//             });
//           }

//         });

//         res.status(200).send('ok:' + snapshot.numChildren());

//       // }).catch(reason => {
//       //   res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       // });

//     }
//     else {
//       // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//       console.log('Map 16, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });


// ref.child('lots').orderByChild('level').equalTo('a').once('value').then(snapshot => {
//   if (snapshot.exists()) {
//     getStatusColors().then(statusColors => {
//       snapshot.forEach(element => {
//         if (element.val().status === 'notyetavailable') {
//           var myupdate = {};
//           myupdate['/lots/' + element.key + '/status'] = 'available';
//           myupdate['/lots/' + element.key + '/maprenderdetails/bg_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].bg_color : 'gray');
//           myupdate['/lots/' + element.key + '/maprenderdetails/fore_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].fore_color : 'white');
//           myupdate['/lots/' + element.key + '/maprenderdetails/status_name'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].name : '');

//           myupdate['/lots/' + element.key + '/designation'] = 'regular';
//           myupdate['/lots/' + element.key + '/maprenderdetails/designation_name'] = (typeof (statusColors['regular']) != 'undefined' ? statusColors['regular'].name : '');
//           myupdate['/lots/' + element.key + '/maprenderdetails/stroke_color'] = (typeof (statusColors['regular']) != 'undefined' ? statusColors['regular'].stroke_color : 'white');

//           ref.update(myupdate).then(function () {
//             console.log("Write completed")
//           }).catch(function (error) {
//             console.log(error)
//           });
//         }

//       });

//       res.status(200).send('ok:' + snapshot.numChildren());

//     }).catch(reason => {
//       res.status(200).send('Map Render Details Updates in status color: ' + reason);
//     });

//   }
//   else {
//     // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//     console.log('Map 16, null');
//   }

// }).catch(reason => {
//   res.status(200).send('Map Render Details Updates: ' + reason);
// });

// ref.child('lots').orderByChild('level').equalTo('b').once('value').then(snapshot => {
//   if (snapshot.exists()) {
//     getStatusColors().then(statusColors => {
//       snapshot.forEach(element => {
//         if (element.val().status === 'notyetavailable') {
//           var myupdate = {};
//           myupdate['/lots/' + element.key + '/status'] = 'available';
//           myupdate['/lots/' + element.key + '/maprenderdetails/bg_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].bg_color : 'gray');
//           myupdate['/lots/' + element.key + '/maprenderdetails/fore_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].fore_color : 'white');
//           myupdate['/lots/' + element.key + '/maprenderdetails/status_name'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].name : '');

//           myupdate['/lots/' + element.key + '/designation'] = 'premium';
//           myupdate['/lots/' + element.key + '/maprenderdetails/designation_name'] = (typeof (statusColors['premium']) != 'undefined' ? statusColors['premium'].name : '');
//           myupdate['/lots/' + element.key + '/maprenderdetails/stroke_color'] = (typeof (statusColors['premium']) != 'undefined' ? statusColors['premium'].stroke_color : 'white');

//           ref.update(myupdate).then(function () {
//             console.log("Write completed")
//           }).catch(function (error) {
//             console.log(error)
//           });
//         }

//       });

//       res.status(200).send('ok:' + snapshot.numChildren());

//     }).catch(reason => {
//       res.status(200).send('Map Render Details Updates in status color: ' + reason);
//     });

//   }
//   else {
//     // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//     console.log('Map 16, null');
//   }

// }).catch(reason => {
//   res.status(200).send('Map Render Details Updates: ' + reason);
// });

// ref.child('lots').orderByChild('level').equalTo('c').once('value').then(snapshot => {
//   if (snapshot.exists()) {
//     getStatusColors().then(statusColors => {
//       snapshot.forEach(element => {
//         if (element.val().status === 'notyetavailable') {
//           var myupdate = {};
//           myupdate['/lots/' + element.key + '/status'] = 'available';
//           myupdate['/lots/' + element.key + '/maprenderdetails/bg_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].bg_color : 'gray');
//           myupdate['/lots/' + element.key + '/maprenderdetails/fore_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].fore_color : 'white');
//           myupdate['/lots/' + element.key + '/maprenderdetails/status_name'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].name : '');

//           myupdate['/lots/' + element.key + '/designation'] = 'premium';
//           myupdate['/lots/' + element.key + '/maprenderdetails/designation_name'] = (typeof (statusColors['premium']) != 'undefined' ? statusColors['premium'].name : '');
//           myupdate['/lots/' + element.key + '/maprenderdetails/stroke_color'] = (typeof (statusColors['premium']) != 'undefined' ? statusColors['premium'].stroke_color : 'white');

//           ref.update(myupdate).then(function () {
//             console.log("Write completed")
//           }).catch(function (error) {
//             console.log(error)
//           });
//         }

//       });

//       res.status(200).send('ok:' + snapshot.numChildren());

//     }).catch(reason => {
//       res.status(200).send('Map Render Details Updates in status color: ' + reason);
//     });

//   }
//   else {
//     // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//     console.log('Map 16, null');
//   }

// }).catch(reason => {
//   res.status(200).send('Map Render Details Updates: ' + reason);
// });

// ref.child('lots').orderByChild('level').equalTo('d').once('value').then(snapshot => {
//   if (snapshot.exists()) {
//     getStatusColors().then(statusColors => {
//       snapshot.forEach(element => {
//         if (element.val().status === 'notyetavailable') {
//           var myupdate = {};
//           myupdate['/lots/' + element.key + '/status'] = 'available';
//           myupdate['/lots/' + element.key + '/maprenderdetails/bg_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].bg_color : 'gray');
//           myupdate['/lots/' + element.key + '/maprenderdetails/fore_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].fore_color : 'white');
//           myupdate['/lots/' + element.key + '/maprenderdetails/status_name'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].name : '');

//           myupdate['/lots/' + element.key + '/designation'] = 'regular';
//           myupdate['/lots/' + element.key + '/maprenderdetails/designation_name'] = (typeof (statusColors['regular']) != 'undefined' ? statusColors['regular'].name : '');
//           myupdate['/lots/' + element.key + '/maprenderdetails/stroke_color'] = (typeof (statusColors['regular']) != 'undefined' ? statusColors['regular'].stroke_color : 'white');

//           ref.update(myupdate).then(function () {
//             console.log("Write completed")
//           }).catch(function (error) {
//             console.log(error)
//           });
//         }

//       });

//       res.status(200).send('ok:' + snapshot.numChildren());

//     }).catch(reason => {
//       res.status(200).send('Map Render Details Updates in status color: ' + reason);
//     });

//   }
//   else {
//     // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//     console.log('Map 16, null');
//   }

// }).catch(reason => {
//   res.status(200).send('Map Render Details Updates: ' + reason);
// });  

// ref.child('lots').orderByChild('level').equalTo('e').once('value').then(snapshot => {
//   if (snapshot.exists()) {
//     getStatusColors().then(statusColors => {
//       snapshot.forEach(element => {
//         if (element.val().status === 'notyetavailable') {
//           var myupdate = {};
//           myupdate['/lots/' + element.key + '/status'] = 'available';
//           myupdate['/lots/' + element.key + '/maprenderdetails/bg_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].bg_color : 'gray');
//           myupdate['/lots/' + element.key + '/maprenderdetails/fore_color'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].fore_color : 'white');
//           myupdate['/lots/' + element.key + '/maprenderdetails/status_name'] = (typeof (statusColors['available']) != 'undefined' ? statusColors['available'].name : '');

//           myupdate['/lots/' + element.key + '/designation'] = 'regular';
//           myupdate['/lots/' + element.key + '/maprenderdetails/designation_name'] = (typeof (statusColors['regular']) != 'undefined' ? statusColors['regular'].name : '');
//           myupdate['/lots/' + element.key + '/maprenderdetails/stroke_color'] = (typeof (statusColors['regular']) != 'undefined' ? statusColors['regular'].stroke_color : 'white');

//           ref.update(myupdate).then(function () {
//             console.log("Write completed")
//           }).catch(function (error) {
//             console.log(error)
//           });
//         }

//       });

//       res.status(200).send('ok:' + snapshot.numChildren());

//     }).catch(reason => {
//       res.status(200).send('Map Render Details Updates in status color: ' + reason);
//     });

//   }
//   else {
//     // res.status(200).send('Map Render Details Updates in status color: snapshot null');
//     console.log('Map 16, null');
//   }

// }).catch(reason => {
//   res.status(200).send('Map Render Details Updates: ' + reason);
// });    




//58 to 65 --remove level e
// exports.deleteLevelEOf58to65 = functions.https.onRequest((req, res) => {
//   ref.child('lots').orderByChild('block').equalTo('58').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().level === 'e') {
//             var myupdate = {};
//             myupdate['/lots/' + element.key] = null;

//             ref.update(myupdate).then(function () {
//               // console.log('/lots/' + element.key + ": Write completed")
//             }).catch(function (error) {
//               console.log('/lots/' + element.key + ":" + error)
//             });
//           }

//         });

//         res.status(200).send('ok:' + snapshot.numChildren());

//       }).catch(reason => {
//         res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       });

//     }
//     else {
//       console.log('Map 58, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });

//   ref.child('lots').orderByChild('block').equalTo('59').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().level === 'e') {
//             var myupdate = {};
//             myupdate['/lots/' + element.key] = null;

//             ref.update(myupdate).then(function () {
//               // console.log('/lots/' + element.key + ": Write completed")
//             }).catch(function (error) {
//               console.log('/lots/' + element.key + ":" + error)
//             });
//           }

//         });

//         res.status(200).send('ok:' + snapshot.numChildren());

//       }).catch(reason => {
//         res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       });

//     }
//     else {
//       console.log('Map 58, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });

//   ref.child('lots').orderByChild('block').equalTo('60').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().level === 'e') {
//             var myupdate = {};
//             myupdate['/lots/' + element.key] = null;

//             ref.update(myupdate).then(function () {
//               // console.log('/lots/' + element.key + ": Write completed")
//             }).catch(function (error) {
//               console.log('/lots/' + element.key + ":" + error)
//             });
//           }

//         });

//         res.status(200).send('ok:' + snapshot.numChildren());

//       }).catch(reason => {
//         res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       });

//     }
//     else {
//       console.log('Map 58, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });

//   ref.child('lots').orderByChild('block').equalTo('61').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().level === 'e') {
//             var myupdate = {};
//             myupdate['/lots/' + element.key] = null;

//             ref.update(myupdate).then(function () {
//               // console.log('/lots/' + element.key + ": Write completed")
//             }).catch(function (error) {
//               console.log('/lots/' + element.key + ":" + error)
//             });
//           }

//         });

//         res.status(200).send('ok:' + snapshot.numChildren());

//       }).catch(reason => {
//         res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       });

//     }
//     else {
//       console.log('Map 58, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });

//   ref.child('lots').orderByChild('block').equalTo('62').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().level === 'e') {
//             var myupdate = {};
//             myupdate['/lots/' + element.key] = null;

//             ref.update(myupdate).then(function () {
//               // console.log('/lots/' + element.key + ": Write completed")
//             }).catch(function (error) {
//               console.log('/lots/' + element.key + ":" + error)
//             });
//           }

//         });

//         res.status(200).send('ok:' + snapshot.numChildren());

//       }).catch(reason => {
//         res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       });

//     }
//     else {
//       console.log('Map 58, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });

//   ref.child('lots').orderByChild('block').equalTo('63').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().level === 'e') {
//             var myupdate = {};
//             myupdate['/lots/' + element.key] = null;

//             ref.update(myupdate).then(function () {
//               // console.log('/lots/' + element.key + ": Write completed")
//             }).catch(function (error) {
//               console.log('/lots/' + element.key + ":" + error)
//             });
//           }

//         });

//         res.status(200).send('ok:' + snapshot.numChildren());

//       }).catch(reason => {
//         res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       });

//     }
//     else {
//       console.log('Map 58, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });

//   ref.child('lots').orderByChild('block').equalTo('64').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().level === 'e') {
//             var myupdate = {};
//             myupdate['/lots/' + element.key] = null;

//             ref.update(myupdate).then(function () {
//               // console.log('/lots/' + element.key + ": Write completed")
//             }).catch(function (error) {
//               console.log('/lots/' + element.key + ":" + error)
//             });
//           }

//         });

//         res.status(200).send('ok:' + snapshot.numChildren());

//       }).catch(reason => {
//         res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       });

//     }
//     else {
//       console.log('Map 58, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });

//   ref.child('lots').orderByChild('block').equalTo('65').once('value').then(snapshot => {
//     if (snapshot.exists()) {
//       getStatusColors().then(statusColors => {
//         snapshot.forEach(element => {
//           if (element.val().level === 'e') {
//             var myupdate = {};
//             myupdate['/lots/' + element.key] = null;

//             ref.update(myupdate).then(function () {
//               // console.log('/lots/' + element.key + ": Write completed")
//             }).catch(function (error) {
//               console.log('/lots/' + element.key + ":" + error)
//             });
//           }

//         });

//         res.status(200).send('ok:' + snapshot.numChildren());

//       }).catch(reason => {
//         res.status(200).send('Map Render Details Updates in status color: ' + reason);
//       });

//     }
//     else {
//       console.log('Map 58, null');
//     }

//   }).catch(reason => {
//     res.status(200).send('Map Render Details Updates: ' + reason);
//   });

// });


