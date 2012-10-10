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
                log("debug", "received " + JSON.stringify(type) + " " + JSON.stringify(data));
                var my_callback = callback || function () {};
                var handlerdomain = domain.create();
                handlerdomain.on("error", function (er) {
                    log("error", er + "\n" + er.stack);
                    log("error", er);
                    my_callback({error: er.toString()});
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
            that.requireMaster(function () {
                var party_data = {owner_id: that.user.id};
                db_collections.parties.insert(party_data, dbErrorDomain.intercept(function () {
                    var party = new PM.models.Party({
                        id: party_data._id.toString(),
                        owner: that.user
                    });
                    PM.collections.Parties.getInstance().add(party);
                    if (callback) {
                        callback(party.id);
                    }
                }));
            });
        });

        socket_action("share action", {party_id: {_isString: true}, _TYPE: {_isString: true}, _strict: false}, function (action_data, callback) {
            that.requireOwner(action_data.party_id, function () {
                // TODO: consider very hard: is there a (theoretical) chance that the actions won't execute the async code below in order
                loadParty(action_data.party_id, function (party) {
                    var action = PM.models.Action.unserializeFromTrusted(action_data);
                    action.party = party;
                    try {
                        action.applyValidatedAction();
                        db_collections.actions.insert(action.serialize(), dbErrorDomain.intercept(function () {
                            callback(true);
                        }));
                    } catch (error) {
                        throw "Error: party " + party.id + ", applying action " + action.get("number") + " failed: " + error.toString();
                    }
                });
            });
        });

        that.requireLoggedin = function (callback) {
            if (!that.isLoggedin()) {
                throw "You need to be logged in for this function to work";
            }
            callback();
        };

        that.requireMaster = function (callback) {
            that.requireLoggedin(function () {
                if (!that.isMaster()) {
                    throw "This function may only be called by the master";
                }
                callback();
            });
        };

        that.requireOwner = function (party_id, callback) {
            that.requireMaster(function () {
                loadParty(party_id, function (party) {
                    if (!party) {
                        throw "mentioned party could not be found";
                    }
                    if (party.get("owner").id !== that.user.id) {
                        throw "not owner of party ";
                    }
                    callback();
                });
            });
        };


        that.isMaster = function () {
            return !!that.master;
        };

        that.isLoggedin = function () {
            return !_.isNull(that.user);
        };
    };

    var loadParty = function (party_id, callback) {
        var party = PM.collections.Parties.getInstance().get(party_id);
        if (party) {
            callback(party);
            return;
        }
        var pcursor = db_collections.parties.find({_id: mongodb.ObjectID(party_id)});
        pcursor.nextObject(dbErrorDomain.intercept(function (object) {
            if (object) {
                var owner = new PM.models.User({id: object.owner_id, _status: PM.models.BaseModelLazyLoad.LOADED});
                party = new PM.models.Party({id: object._id.toString(), owner: owner});
                PM.collections.Parties.getInstance().add(party);
                var acursor = db_collections.actions.find({party_id: party.id}, {sort: ["number", 1]});
                acursor.each(dbErrorDomain.intercept(function (action_data) {
                    if (!action_data) {
                        callback(party);
                    }
                    var action = PM.models.Action.unserializeFromTrusted(action_data);
                    action.party = party;
                    action.validateAndApplyAction(function () {}, function (error) {
                        throw "Error while loading party " + party.id + ", applying action " + action.get("number") + " failed: " + error;
                    });
                }));
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

