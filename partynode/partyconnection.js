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
        initialize: function (socket, db_collections, db_error_domain) {
            var that = this;
            that.error = false;
            that.queue = [];
            that.socket = socket;
            that.db_collections = db_collections;
            that.db_error_domain = db_error_domain;
            that.log("info", "New connection from " + socket.handshake.address.address + ":" + socket.handshake.address.port);
        },

        /**
         * Takes care of constraint checking
         * Attaches the error domain
         * Makes sure the next message only is handled when the previous one has been received
         */
        socket_action: function (type, constraints, handler, bind_method) {
            var that = this;
            bind_method = bind_method || "on";
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
            that.socket[bind_method](type, function () {
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

        listenForLogin: function () {
            var that = this;
            var constraint = {
                token: {
                    _isString: true,
                    _matches: /^[A-Za-z0-9]{10,200}$/
                },
                master: {
                    _isBoolean: true
                }
            };
            that.socket_action("login", constraint, function (data, callback) {
                var token = data.token;
                var url = "https://graph.facebook.com/me?fields=id%2Cname&access_token=" + encodeURIComponent(token);
                request.get(url, function (error, undefined /*response*/, json) {
                    if (error) {
                        throw error;
                    }
                    var object = JSON.parse(json);
                    if (!object.id) {
                        throw "No valid response: " + json;
                    }
                    that.user_id = parseInt(object.id, 10);
                    if (data.master) {
                        that.listenMaster();
                        that.log("info", "User \"" + object.name + "\" (" + that.user_id + ") loggedin in as master");
                    } else {
                        that.listenClient();
                        that.log("info", "User \"" + object.name + "\" (" + that.user_id + ") loggedin in");
                    }
                    callback(true);
                });
            }, "once");

        },

        listenMaster: function () {
            var that = this;
            
            /* returns party_id */
            that.socket_action("create new party", {_isNull: true}, function (undefined, callback) {
                var party_data = {owner_id: that.user_id, _id: clutils.getUniqueId()};
                that.db_collections.parties.insert(party_data, that.db_error_domain.intercept(function () {
                    var party = new PM.models.Party(party_data);
                    PM.collections.Parties.getInstance().add(party);
                    callback(party.id);
                }));
            });

            var constraints = {
                party_id: {
                    _isString: true
                },
                _TYPE: {
                    _isString: true
                },
                _strict: false
            };
            that.socket_action("share action", constraints, function (action_data, callback) {
                that.loadParty(action_data.party_id, function (party) {
                    if (!party || !party.isOwner(that.user_id)) {
                        throw "Party cannot be found";
                    }
                    var action = PM.models.Action.unserializeFromTrusted(action_data);
                    action.party = party;
                    try {
                        console.log(action.get("created"));
                        action.applyValidatedAction();
                        that.db_collections.actions.insert(action.serialize(), that.db_error_domain.intercept(function () {
                            callback(true);
                        }));
                    } catch (error) {
                        throw "Error: party " + party.id + ", applying action " + action.get("number") + " failed: " + error.toString() + "\n" + error.stack;
                    }
                });
            });
        },

        loadParty: function (party_id, callback) {
            var that = this;
            var party = PM.collections.Parties.getInstance().get(party_id);
            if (party) {
                callback(party);
                return;
            }
            var pcursor = that.db_collections.parties.find({_id: party_id});
            pcursor.nextObject(that.db_error_domain.intercept(function (object) {
                if (object) {
                    party = new PM.models.Party(object);
                    PM.collections.Parties.getInstance().add(party);
                    var acursor = that.db_collections.actions.find({party_id: party.id}, {sort: ["number", 1]});
                    acursor.each(that.db_error_domain.intercept(function (action_data) {
                        if (!action_data) {
                            //all action data has been loaded
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

        },

    }, {

    });
})();
