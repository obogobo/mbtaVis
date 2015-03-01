var http = require('http'),
    ProtoBuf = require('protobufjs'),
    csv = require('csv'),
    q = require('q'),
    _ = require('lodash');

var app = http.createServer(handler),
    io = require('socket.io')(app),
    fs = require('fs');

// start the server
//app.listen(8080);


function handler(req, res) {
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


// maps route_ids -> route_names
function parseRoutes() {
    var deferred = q.defer(),
        whitelist = "Red Line, Blue Line, Green Line, Orange Line".split(', ');

    csv.parse(fs.readFileSync('mbta_gtfs/routes.txt'), function (err, data) {
        if (err) deferred.reject(err);
        else {
            deferred.resolve(_.reduce(data, function (obj, arr) {
                _(whitelist).contains(arr[3]) && (obj[arr[0]] = arr[3]);
                return obj;
            }, {}));
        }
    });

    return deferred.promise;
}

function parseStations() {
    var deferred = q.defer(),
        whitelist = ['1'];

    csv.parse(fs.readFileSync('mbta_gtfs/stops.txt'), function (err, data) {
        if (err) deferred.reject(err);
        else {
            deferred.resolve(_.reduce(data, function (obj, arr) {
                _(whitelist).contains(arr[8]) && (obj[arr[0]] = arr[2]);
                return obj;
            }, {}));
        }
    });

    return deferred.promise;
}

function fetchFeed(url, parser) {
    var transit = ProtoBuf.protoFromFile('gtfs-realtime.proto').build('transit_realtime');
    // ^^ create a protobuf decoder // your protobuf binary feed URL

    http.get(url, function (res) {
        var data = [];
        res.on("data", function (chunk) {
            data.push(chunk);
        });
        res.on("end", function () {
            // create a FeedMessage object by decooding the data with the protobuf object
            parser(transit.FeedMessage.decode(Buffer.concat(data)))
        });
    });
}

parseRoutes()
    .then(function (routes) {
        fetchFeed('http://developer.mbta.com/lib/GTRTFS/Alerts/VehiclePositions.pb',
            function (msg) {
                var vehicles = _(msg.entity)
                    .pluck('vehicle')
                    .filter(function (vehicle) {
                        return _.contains(_.keys(routes), vehicle.trip.route_id);
                    })
                    .groupBy(function(vehicle) {
                        return vehicle.vehicle.id
                    }).value();

                fetchFeed('http://developer.mbta.com/lib/GTRTFS/Alerts/TripUpdates.pb',
                    function(msg) {
                        var updates = _.filter(msg.entity, function(entity) {
                            return _.contains(_.keys(routes), entity.trip_update.trip.route_id);
                        });

                        _.forEach(updates, function(update) {
                            debugger;
                            update.trip_update.vehicle = vehicles[update.trip_update.vehicle.id];
                        });

                        console.log(JSON.stringify(updates, null, 2));
                    });
            }
        );
    });