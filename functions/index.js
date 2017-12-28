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

exports.updateBlocksMapRenderDetails = functions.https.onRequest((req, res) => {
  ref.child('blocks').once('value').then(snapshot => {
    // .orderByChild('maprenderdetailsupdate').equalTo(1).limitToFirst(100)

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


  }).catch(reason => {
    res.status(200).send('Map Render Details Updates: ' + reason);
  });

});

exports.updateLotsMapRenderDetails = functions.https.onRequest((req, res) => {
  ref.child('lots').once('value').then(snapshot => {
    // .orderByChild('maprenderdetailsupdate').equalTo(1).limitToFirst(100)

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


  }).catch(reason => {
    res.status(200).send('Map Render Details Updates: ' + reason);
  });

});

exports.setupMapRenderDetailsFirst = functions.https.onRequest((req, res) => {
  ref.child('lots').limitToFirst(300).once('value').then(snapshot => {
    snapshot.forEach(element => {

      // var mapRenderDetails = {
      //   bg_color: '',
      //   stroke_color: '',
      //   fore_color: '',
      //   designation_name: '',
      //   status_name: '',
      //   type_name: ''
      // };

      // maprenderdetails: mapRenderDetails,

      element.ref.update({
        maprenderdetailsupdate: 1
      });
    });

    res.status(200).send('ok:' + snapshot.numChildren());

  }).catch(reason => {
    res.status(200).send('Map Render Details setup: ' + reason);
  });

});


exports.countLots = functions.https.onRequest((req, res) => {
  ref.child('lots').orderByChild('maprenderdetailsupdate').equalTo(1).once('value').then(snapshot => {
    res.status(200).send('total is ' + snapshot.numChildren());
  }).catch(reason => {
    res.status(200).send('count Render Details Updates: ' + reason);

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

const getStatusColors = () => {
  return admin.database().ref('/statuscolor').once('value').then(snap => {
    return snap.val();
  });
}

