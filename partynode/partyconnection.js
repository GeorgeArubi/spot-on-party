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

    var ActivePartyCollection = PM.collections.Parties.extend({
    });

    partyconnection.Connection = Toolbox.Base.extend({
        initialize: function (socket, db_collections, db_error_domain, partynode_data) {
            var that = this;
            that.error = false;
            that.queue = [];
            that.socket = socket;
            that.socket.on("disconnect", _.bind(that.onDisconnect, that));
            that.db_collections = db_collections;
            that.db_error_domain = db_error_domain;
            that.user_id = partynode_data.user_id;
            that.username = partynode_data.username;
            that.cursors = {};
        },

        onDisconnect: function () {
            throw "Running abstract onDisconnect. Shouldn't be doing that....";
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

        loadParties: function (query, options, callback) {
            var that = this;
            clutils.checkConstraints(options, {
                before_timestamp: {
                    _isTimestamp: true,
                    _optional: true,
                },
                limit: {
                    _isNumber: true,
                },
            });
            if (options.before_timestamp) {
                query.last_updated = {'$lt': options.before_timestamp};
            }

            var cursor = that.db_collections.partyindex.find(query, {sort: [["last_updated", "desc"]]});
            if (options.limit) {
                cursor.batchSize = Math.max(options.limit, 2); // batchSize of 1 doesn't seem to be supported...
            }
            var readMore = function (parties_data) {
                cursor.nextObject(that.catchDatabaseError(function (partyindex_data) {
                    if (!partyindex_data || (options.limit && options.limit === parties_data.length)) {
                        //done
                        callback(parties_data, cursor.totalNumberOfRecords - parties_data.length);
                    } else {
                        var party_id = partyindex_data._id;
                        that.loadParty(party_id, function (party) {
                            parties_data.push(party.serialize());
                            readMore(parties_data);
                        });
                    }
                }));
            };
            readMore([]);
        },

        loadParty: function (party_id, callback) {
            var that = this;
            var party = that.constructor.getPartyCache().get(party_id);
            if (party) {
                callback(party);
                return;
            }
            party = new PM.models.Party({_id: party_id});
            that.constructor.getPartyCache().add(party);
            var acursor = that.db_collections.actions.find({party_id: party.id}, {sort: {"number": 1}});
            acursor.each(that.catchDatabaseError(function (action_data) {
                if (action_data) {
                    var action = PM.models.Action.unserializeFromTrusted(action_data, party);
                    action.applyValidatedAction();
                } else {
                    //all action data has been loaded, we're done
                    if (party.get("active")) {
                        // party can't be active, or we would have had it in cache. So probably victim of server crash. End the party
                        party.createAndApplyMasterAction("End", {}, function (action) {
                            that.db_collections.actions.insert(action.serialize(), that.catchDatabaseError(function () {
                                callback(party);
                            }));
                        });
                    } else {
                        callback(party);
                    }
                }
            }));
        },

        catchDatabaseError: function (callback) {
            var that = this;
            return function () {
                var args = _.toArray(arguments);
                var error = args.shift();
                if (error) {
                    that.db_error_domain.run(function () {
                        throw error;
                    });
                }
                return callback.apply(null, args);
            };
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
                    if (clutils.toBoolean(handshakeData.query.master)) {
                        handshakeData.partynode.ConnectionClass = partyconnection.MasterConnection;
                    } else {
                        handshakeData.partynode.ConnectionClass = partyconnection.ClientConnection;
                    }
                    callback(null, true);
                });
            });
        },

        getPartyCache: function () {
            if (!partyconnection.Connection.partyCache) {
                partyconnection.Connection.partyCache = new PM.collections.Parties();
            }
            return partyconnection.Connection.partyCache;
        },

        getActivePartyCollection: function () {
            if (!partyconnection.Connection.activePartyCollection) {
                partyconnection.Connection.activePartyCollection = new ActivePartyCollection();
            }
            return partyconnection.Connection.activePartyCollection;
        },
    });

    partyconnection.MasterConnection = partyconnection.Connection.extend({
        initialize: function () {
            var that = this;
            partyconnection.Connection.prototype.initialize.apply(that, arguments);
            that.log("info", "New master connection from " + that.socket.handshake.address.address + ":" + that.socket.handshake.address.port + " user " + that.username + "(" + that.user_id + ")");
        },


        onDisconnect: function () {
            var that = this;
            that.log("Disconnect");
            that.deactivateParty(false);
        },
        
        listen: function () {
            var that = this;
            that.setupListen("share action");
            that.setupListen("activate party");
            that.setupListen("update token");
            that.setupListen("get own parties");
        },

        /**
         * Activates a party, which means that this connection will be the master of the party, and the party will be active to all members
         * takes a party_id (party_id of 0 (not "0") means that the no party will be active.
         * It returns the latest version of the party on the server. The client is expected to use this version (and not some other locally cached version), since in theory, it may have changed (for one thing, a "End" and "Start" may have been added and all clients may have been kicked).
         **/
        "activate party": function (party_id, callback) {
            var that = this;
            that.activateParty(party_id, function (party) {
                if (!party_id) {
                    callback();
                    return;
                }
                if (!party) {
                    throw "Party not found";
                }
                callback(party.serialize());
            });
        },
        "activate party constraints": {
            _isUniqueIdOrZero: true,
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
                    that.db_collections.actions.insert(action.serialize(), that.catchDatabaseError(function () {
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

        "get own parties": function (options, callback) {
            var that = this;
            var query = {
                owner_id: that.user_id,
            };
            return that.loadParties(query, options, callback);
        },
        "get own parties constraints": {
            before_timestamp: {
                _isTimestamp: true,
                _optional: true,

            },
            limit: {
                _isNumber: true,
            },
        },

        deactivateParty: function (forced_by_actived_somewhere_else, callback) {
            var that = this;
            var That = that.constructor;
            var party_id = that.active_party_id;
            if (that.active_party_id) {
                that.log("info", "deactivating party " + party_id);
                var party = That.getActivePartyCollection().get(that.active_party_id);
                if (party.ownerConnection !== that) {
                    throw "Can only deativate own party";
                }
                party.ownerConnection = null;
                party.createAndApplyMasterAction("End", {}, function (action) {
                    that.db_collections.actions.insert(action.serialize(), that.catchDatabaseError(function () {
                        That.getActivePartyCollection().remove(party);
                        if (forced_by_actived_somewhere_else) {
                            that.socket.emit("forced deactivated party", party.id);
                        }
                        that.active_party_id = 0;
                        if (callback) {
                            callback();
                        }
                    }));
                });
            } else {
                if (callback) {
                    callback();
                }
            }
        },

        activateParty: function (party_id, callback) {
            var that = this;
            var That = that.constructor;
            var activate = function () {
                if (party_id) {
                    that.loadParty(party_id, function (party) {
                        if (party.get("owner_id") !== that.user_id) {
                            throw "Party with id " + party_id + "not found";
                        }
                        if (That.getActivePartyCollection().get(party_id)) {
                            party.ownerConnection.deactivateParty(true);
                        }
                        party.ownerConnection = that;
                        party.createAndApplyMasterAction("Start", {}, function (action) {
                            that.db_collections.actions.insert(action.serialize(), that.catchDatabaseError(function () {
                                That.getActivePartyCollection().add(party);
                                that.active_party_id = party.id;
                                callback(party);
                            }));
                        });
                    });
                } else {
                    callback();
                }
            };
            if (that.active_party_id) {
                that.deactivateParty(false, activate);
            } else {
                activate();
            }
        },
    });

    partyconnection.ClientConnection = partyconnection.Connection.extend({
        initialize: function () {
            var that = this;
            partyconnection.Connection.prototype.initialize.apply(that, arguments);
            that.log("info", "New client connection from " + that.socket.handshake.address.address + ":" + that.socket.handshake.address.port + " user " + that.username + "(" + that.user_id + ")");
        },

        listen: function () {
            var that = this;
            that.setupListen("update token");
            that.setupListen("get my active parties");
            that.setupListen("get my parties");
            that.setupListen("get my party");
        },

        "get my party": function (party_id, callback) {
            var that = this;
            that.loadParty(party_id, function (party) {
                if (!party.isMember(that.user_id)) {
                    throw "Party with id " + party_id + "not found";
                }
                callback(party.serialize());
            });
        },
        "get my party constraints": {
            _isUniqueId: true
        },


        "get my active parties": function (options, callback) {
            var that = this;
            var query = {
                user_ids: that.user_id,
                active: true,
            };
            return that.loadParties(query, options, callback);
        },
        "get my active parties constraints": {
            before_timestamp: {
                _isTimestamp: true,
                _optional: true,
            },
            limit: {
                _isNumber: true,
            },
        },

        "get my parties": function (options, callback) {
            var that = this;
            var query = {
                user_ids: that.user_id,
            };
            return that.loadParties(query, options, callback);
        },
        "get my parties constraints": {
            before_timestamp: {
                _isTimestamp: true,
                _optional: true,
            },
            limit: {
                _isNumber: true,
            },
        },
    });
})();
 
