/*jshint node:true */

var partyconnection = exports;


(function () {
    "use strict";

    var _ = require("./includes/underscore");
    var Toolbox = require("./includes/toolbox");
    var PM = require("./includes/models");
    var clutils = require("./includes/clutils");
    var domain = require('domain');
    var request = require("request");
    var winston = require("winston");

    partyconnection.Connection = Toolbox.Base.extend({
        initialize: function (socket, db_collections, db_error_domain, partynode_data) {
            var that = this;
            that.error = false;
            that.queue = [];
            that.socket = socket;
            that.db_collections = db_collections;
            that.db_error_domain = db_error_domain;
            that.user_id = partynode_data.user_id;
            that.username = partynode_data.username;
            that.log("info", "New master connection from " + socket.handshake.address.address + ":" + socket.handshake.address.port + " user " + that.username + "(" + that.user_id + ")");
        },

        listen: function () {
            var that = this;
            that.setupListen("share action");
            that.setupListen("get own party");
            that.setupListen("update token");
        },

        "share action": function (action_data, callback) {
            var that = this;
            that.loadParty(action_data.party_id, function (party) {
                if (party.get("log").length === 0) {
                    clutils.checkConstraints(action_data._TYPE, {_is: PM.models.InitializeAction.type});
                } else if (!party.isOwner(that.user_id)) {
                    throw "Not party's owner";
                }
                var action = PM.models.Action.unserializeFromTrusted(action_data, party);
                try {
                    action.applyValidatedAction();
                    that.db_collections.actions.insert(action.serialize(), that.db_error_domain.intercept(function () {
                        callback(true);
                        that.db_collections.partyindex.save(party.indexableObject());
                    }));
                } catch (error) {
                    throw "Error: party " + party.id + ", applying action " + action.get("number") + " failed: " + error.toString() + "\n" + error.stack;
                }
            });
        },
        "share action constraints": {
            party_id: {
                _isUniqueId: true
            },
            _TYPE: {
                _isString: true
            },
            _strict: false
        },

        "update token": function (token, callback) {
            var that = this;
            var url = "https://graph.facebook.com/me?fields=id%2Cname&access_token=" + encodeURIComponent(token);
            request.get(url, function (error, undefined /*response*/, json) {
                if (error) {
                    throw error;
                }
                var object = JSON.parse(json);
                var user_id = parseInt(object.id, 10);
                if (user_id !== that.user_id) {
                    throw "expected a valid token of the same user";
                }
                that.token = token;
                callback(true);
            });
        },
        "update token constraints": {
            _matches: /^[A-Za-z0-9]{10,200}$/
        },

        "get own party": function (party_id, callback) {
            var that = this;
            that.loadParty(party_id, function (party) {
                if (party.get("owner_id") !== that.user_id) {
                    throw "Party with id " + party_id + "not found";
                }
                callback(party.serialize());
            });
        },
        "get own party constraints": {
            _isUniqueId: true
        },

        setupListen: function (name) {
            var that = this;
            var handler = _.bind(that[name], that);
            var constraints = that[name + " constraints"];
            that.socket_action(name, constraints, handler);
        },

        /**
         * Takes care of constraint checking
         * Attaches the error domain
         * Makes sure the next message only is handled when the previous one has been received
         */
        socket_action: function (type, constraints, handler) {
            var that = this;
            var new_handler = function (data, callback) {
                var my_callback = function () {
                    if (callback) {
                        callback.apply(that, arguments);
                    }
                    that.queue.shift(); //take myself off
                    _.delay(function () {
                        if (that.queue.length > 0) {
                            that.queue[0]();
                        }
                    }, 0);
                };
                that.log("debug", "received " + JSON.stringify(type) + " " + JSON.stringify(data));
                var handlerdomain = domain.create();
                handlerdomain.on("error", function (er) {
                    that.error = er;
                    that.log("error", er + "\n" + er.stack);
                    that.log("error", er);
                    my_callback({error: er.toString()});
                });
                handlerdomain.run(function () {
                    if (that.error) {
                        throw "connection still in error: " + that.error;
                    }
                    clutils.checkConstraints(data, constraints);
                    handler(data, my_callback);
                });
            };
            that.socket.on(type, function () {
                var args = arguments;
                that.queue.push(function () {new_handler.apply(that, args); });
                if (that.queue.length === 1) {
                    //else someone else was runnig atm
                    that.queue[0]();
                }
            });
        },

        log: function (severity, message, metadata) {
            var that = this;
            winston.log(severity, that.socket.id + ": " + message, metadata);
        },

        loadParty: function (party_id, callback) {
            var that = this;
            var party = PM.collections.Parties.getInstance().get(party_id);
            if (party) {
                callback(party);
                return;
            }
            party = new PM.models.Party({_id: party_id});
            PM.collections.Parties.getInstance().add(party);
            var acursor = that.db_collections.actions.find({party_id: party.id}, {sort: {"number": 1}});
            acursor.each(that.db_error_domain.intercept(function (action_data) {
                if (action_data) {
                    var action = PM.models.Action.unserializeFromTrusted(action_data, party);
                    action.applyValidatedAction();
                } else {
                    //all action data has been loaded, we're done
                    callback(party);
                }
            }));
        },
    }, {

        authorize: function (handshakeData, callback) {
            var constraint = {
                token: {
                    _isString: true,
                    _matches: /^[A-Za-z0-9]{10,200}$/
                },
                master: {
                    _matches: /^[01]$/,
                },
                t: {
                    _isTimestamp: true,
                },
            };
            var handshake_domain = domain.create();
            handshake_domain.on("error", function (er) {
                winston.log("info", "login failed from " + handshakeData.address.address + " with data " + JSON.stringify(handshakeData.query));
                callback(er, false);
            });
            handshake_domain.run(function () {
                clutils.checkConstraints(handshakeData.query, constraint);
                var token = handshakeData.query.token;
                var url = "https://graph.facebook.com/me?fields=id%2Cname&access_token=" + encodeURIComponent(token);
                request.get(url, function (error, undefined /*response*/, json) {
                    if (error) {
                        throw error;
                    }
                    var object = JSON.parse(json);
                    if (!object.id) {
                        throw "No valid response: " + json;
                    }
                    handshakeData.partynode = {
                        user_id: parseInt(object.id, 10),
                        username: object.name,
                    };
                    if (handshakeData.query.master) {
                        handshakeData.partynode.ConnectionClass = partyconnection.Connection;
                    } else {
                        throw "no not-master connect yet";
                    }
                    callback(null, true);
                });
            });
        },

    });
})();
