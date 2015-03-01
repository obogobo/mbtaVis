var http = require('http'),
    ProtoBuf = require('protobufjs'),
    q = require('q'),
    _ = require('lodash');

var app = http.createServer(handler),
    io = require('socket.io')(app),
    fs = require('fs');

// start the server
app.listen(8080);


function handler (req, res) {
    fs.readFile(__dirname + '/index.html',
        function (err, data) {
            if (err) {
                res.writeHead(500);
                return res.end('Error loading index.html');
            }

            res.writeHead(200);
            res.end(data);
        });
}

// listen for websocket connections
io.on('connection', function (socket) {
    socket.emit('news', { hello: 'world' });
    socket.on('my other event', function (data) {
        console.log(data);
    });
});


// create a protobuf decoder // your protobuf binary feed URL
var transit = ProtoBuf.protoFromFile('gtfs-realtime.proto').build('transit_realtime');


// get trip progress and updates
http.get('http://developer.mbta.com/lib/GTRTFS/Alerts/TripUpdates.pb', function(res) {
     var data = [];
    res.on("data", function(chunk) { data.push(chunk); });
    res.on("end", function() {
        data = Buffer.concat(data);

        // create a FeedMessage object by decooding the data with the protobuf object
        var msg = transit.FeedMessage.decode(data);

            //vehicles = _.pluck(msg.entity, 'vehicle');




        console.log(JSON.stringify(msg, null, 2));
        debugger;
    });    

});

// get vehicle positions
http.get('http://developer.mbta.com/lib/GTRTFS/Alerts/VehiclePositions.pb', function(res) {
    var data = [];
    res.on("data", function(chunk) { data.push(chunk); });
    res.on("end", function() {
        data = Buffer.concat(data);

        // create a FeedMessage object by decooding the data with the protobuf object
        var msg = transit.FeedMessage.decode(data),
            vehicles = _.pluck(msg.entity, 'vehicle');



        //console.log(JSON.stringify(vehicles, null, 2));
        debugger;
    });
});

