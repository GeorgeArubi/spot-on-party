#!/usr/local/bin/node
/*jshint browser:false, node:true, nonew:false */

(function () {
    "use strict";
    var _ = require("./includes/underscore");
    var PM = require("./includes/models");
    var clutils = require("./includes/clutils");
    var https = require("https");
    var winston = require("winston");

    var app = require('express')();
    var server = require('http').createServer(app);
    var io = require('socket.io').listen(server);
    var domain = require('domain');
    var mongodb = require('mongodb');
    var config = require("./config");
    var db; /* my database connection */
    var db_collections = {};

    var dbErrorDomain = domain.create();

    dbErrorDomain.on("error", function (er) {
        winston.error("Error with database connection: " + er);
    });


    server.listen(8081);

    app.get('/', function (req, res) {
        res.sendfile(__dirname + '/index.html');
    });

    var createClientConnection = function (socket) {
        var that = {};
        that.master = false;
        that.user = null;

        var log = function (severity, message, metadata) {
            winston.log(severity, socket.id + ": " + message, metadata);
        };
        log("info", "New connection from " + socket.handshake.address.address + ":" + socket.handshake.address.port);


        var socket_action = function (type, constraints, handler) {
            var new_handler = function (data, callback) {
                var my_callback = callback || function () {};
                var handlerdomain = domain.create();
                handlerdomain.on("error", function (er) {
                    log("error", that.number + ": " + er);
                    my_callback({error: er});
                });
                handlerdomain.run(function () {
                    clutils.checkConstraints(data, constraints);
                    handler(data, my_callback);
                });
            };
            socket.on(type, new_handler);
        };

        socket_action("login", {token: {_isString: true}, master: {_isBoolean: true}}, function (data, callback) {
            if (that.isLoggedin()) {
                throw "Trying to log in again someone else, that can't be right!";
            }
            var token = data.token;
            if (!token.match(/^[A-Za-z0-9]{10,200}$/)) {
                throw "Illegal token, hack attempt? " + token;
            }
            https.get("https://graph.facebook.com/me?fields=id,name&access_token=" + encodeURIComponent(token), function (res) {
                var json = "";
                res.on("data", function (chunk) {
                    json += chunk;
                });
                res.on("end", function () {
                    var object = JSON.parse(json);
                    if (!object.id) {
                        throw "No valid response: " + json;
                    }
                    var user_id = parseInt(object.id, 10);
                    that.user = new PM.models.User({id: user_id, _status: PM.models.BaseModelLazyLoad.LOADED});
                    that.master = !!data.master;
                    if (callback) {
                        callback(true);
                    }
                    log("info", "User \"" + object.name + "\" (" + that.user.id + ") loggedin in" + (that.isMaster() ? " as master":""));
                });

            });
        });

        /* returns party_id */
        socket_action("create new party", {_isNull: true}, function (undefined, callback) {
            that.requireMaster();
            var party_data = {owner_id: that.user.id};
            db_collections.parties.insert(party_data, dbErrorDomain.intercept(function () {
                var party = new PM.models.Party({
                    id: party_data._id.toString(),
                    owner: that.user
                });

                if (callback) {
                    callback(party.id);
                }
            }));
        });

        socket_action("new action", {party_id: {_isNumber: true}, _strict: false}, function (action, callback) {
            that.requireOwner(action.party_id);
            var party = loadParty(action.party_id);
            callback(party);
        });

        that.requireLoggedin = function () {
            if (!that.isLoggedin()) {
                throw "You need to be logged in for this function to work";
            }
        };

        that.requireMaster = function () {
            that.requireLoggedin();
            if (!that.isMaster()) {
                throw "This function may only be called by the master";
            }
        };

        that.requireOwner = function (party_id) {
            that.requireMaster();
            var party = loadParty(party_id);
            if (!party) {
                throw "mentioned party could not be found";
            }
            if (party.owner_id !== that.user.id) {
                throw "not owner of party";
            }
        };


        that.isMaster = function () {
            return !!that.master;
        };

        that.isLoggedin = function () {
            return !_.isNull(that.user);
        };
    };

    var loadParty = function (party_id, callback) {
        var party = PM.collections.Parties.get(party_id);
        if (party) {
            callback(party);
            return;
        }
        var cursor = db_collections.parties.find({_id: mongodb.ObjectID(party_id)});
        cursor.nextObject(dbErrorDomain.inject(function (object) {
            if (object) {
                party = object;
                callback(party);
            } else {
                callback(null);
            }
        }));
    };

    var mongoServer = new mongodb.Server(config.db.host, config.db.port, config.db.serverOptions);
    db = new mongodb.Db(config.db.database, mongoServer, config.db.dbOptions);
    db.open(dbErrorDomain.intercept(function () {
        db.authenticate(config.db.username, config.db.password, dbErrorDomain.intercept(function (success) {
            if (!success) {
                throw "DB authentication denied";
            }

            db_collections.parties = new mongodb.Collection(db, "parties");
            db_collections.actions = new mongodb.Collection(db, "actions");

            io.sockets.on('connection', function (socket) {
                createClientConnection(socket);
            });

        }));
    }));


})();

