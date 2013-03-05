/*jshint node:true */

var partyconnection = exports;


(function () {
    "use strict";

    var _ = require("../shared/underscore");
    var Toolbox = require("../shared/toolbox");
    var PM = require("../shared/models");
    var clutils = require("../shared/clutils");
    var domain = require('domain');
    var request = require("request");
    var winston = require("winston");

    var parties_per_user = {};

    var ActivePartyCollection = PM.collections.Parties.extend({
        initialize: function () {
            console.log("initializing active party collection");
            var that = this;

            that.on("remove", function (party) {
                party.get("users").each(function (user_in_party) {
                    var user_id = user_in_party.get("user_id");
                    delete parties_per_user[user_id][party.id];
                    _.each(partyconnection.ClientConnection.getConnectionsForUserId(user_id), function (connection) {
                        connection.alertMinusActiveParty(party);
                    });
                });
                party.get("users").off("add", that.onMemberInvite, party);
                party.get("users").off("remove", that.onMemberKick, party);
                party.get("log").off("add", that.onLogitemAdd, party);
            });
            that.on("add", function (party) {
                party.get("users").each(function (user_in_party) {
                    var user_id = user_in_party.get("user_id");
                    parties_per_user[user_id] = parties_per_user[user_id] || {};
                    parties_per_user[user_id][party.id] = party;
                    _.each(partyconnection.ClientConnection.getConnectionsForUserId(user_id), function (connection) {
                        connection.alertPlusActiveParty(party);
                    });
                });
                party.get("users").on("add", that.onMemberInvite, party);
                party.get("users").on("remove", that.onMemberKick, party);
                party.get("log").on("add", that.onLogitemAdd, party);
            });
        },

        onLogitemAdd: function (action) {
            var party = this; // this is weird but we're binding this to the party so that we have a consistent item to add and remove as event handler
            party.get("users").each(function (user_in_party) {
                var user_id = user_in_party.get("user_id");
                _.each(partyconnection.ClientConnection.getConnectionsForUserId(user_id), function (connection) {
                    connection.alertNewActivePartyAction(action);
                });
            });
        },

        onMemberInvite: function (user_in_party) {
            var party = this; // this is weird but we're binding this to the party so that we have a consistent item to add and remove as event handler
            var user_id = user_in_party.get("user_id");
            parties_per_user[user_id] = parties_per_user[user_id] || {};
            parties_per_user[user_id][party.id] = party;
            _.each(partyconnection.ClientConnection.getConnectionsForUserId(user_id), function (connection) {
                connection.alertPlusActiveParty(party);
            });
        },

        onMemberKick: function (user_in_party) {
            var party = this; // this is weird but we're binding this to the party so that we have a consistent item to add and remove as event handler
            var user_id = user_in_party.get("user_id");
            delete parties_per_user[user_id][party];
            _.each(partyconnection.ClientConnection.getConnectionsForUserId(user_id), function (connection) {
                connection.alertMinusActiveParty(party.id);
            });
        },
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
            var new_handler = function (data, callback, recievetime) {
                var waittime = (new Date()).valueOf() - recievetime;
                var my_callback = function () {
                    if (callback) {
                        callback.apply(that, arguments);
                    }
                    that.log("info", "Call " + JSON.stringify(type) + " finished in " + ((new Date()).valueOf() - starttime) / 1000 + "s (" + waittime / 1000 + "s in waiting)");
                    clearInterval(log_timer);
                    that.queue.shift(); //take myself off
                    _.delay(function () {
                        if (that.queue.length > 0) {
                            that.queue[0]();
                        }
                    }, 0);
                };
                var starttime = (new Date()).valueOf();
                var log_timer = setInterval(function () {
                    that.log("warn", "Function " + JSON.stringify(type) + " is taking " + ((new Date()).valueOf() - starttime) / 1000 + "s and still running");
                }, 1000);
                var handlerdomain = domain.create();
                handlerdomain.on("error", function (er) {
                    that.error = er;
                    that.log("error", ((new Date()).valueOf() - starttime) / 1000 + "s after start: " + er + "\n" + er.stack);
                    clearInterval(log_timer);
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
                var args = _.toArray(arguments);
                args.push((new Date()).valueOf());
                that.log("debug", "received " + JSON.stringify(type) + " " + JSON.stringify(args[0]));
                if (that.queue.length > 0) {
                    that.log("debug", "call in waiting");
                }
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
                if (!root.counter) {
                    root.counter = 0;
                }
                var localcounter = root.counter++;
                console.log("start request " + localcounter + ": " + url);
                request.get(url, function (error, undefined /*response*/, json) {
                    console.log("done request " + localcounter + ": " + url);
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
            that.socket.emit("connection initialized");
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


        "share action": function (action_data, callback) {
            var that = this;
            that.loadParty(action_data.party_id, function (party) {
                if (party.get("log").length === 0) {
                    clutils.checkConstraints(action_data._TYPE, {_is: PM.models.InitializeAction.type});
                } else if (!party.isOwner(that.user_id)) {
                    throw "Not party's owner";
                }
                var action = PM.models.Action.unserializeFromTrusted(action_data, party);
                //first set number manually, only apply action after it has been saved to the database... Note that this is dangerous: this may result in an action being saved that actually crashes in the "apply". It's better than the alternative though; which may result in an action not in the database, but applied locally
                action.set("number", action.party.get("log").length + 1, {silent: true});
                that.db_collections.actions.insert(action.serialize(), that.catchDatabaseError(function () {
                    try {
                        action.applyValidatedAction();
                    } catch (error) {
                        that.db_collections.actions.remove({party_id: action.party_id, number: action.number});
                        //still may leave stuff in not-nice state, but at least there shouldn't be "holes" in the database... I hope....
                        throw "Error: party " + party.id + ", applying action " + action.get("number") + " failed: " + error.toString() + "\n" + error.stack;
                    }
                    that.db_collections.partyindex.save(party.indexableObject(), function () { callback(true); });
                }));
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

        sendAction: function (action, callback) {
            var that = this;
            return that.sendActionData(action.serialize(), callback);
        },

        sendActionData: function (action_data, callback) {
            var that = this;
            that.socket.emit("new active party action", action_data, function (result) {
                if (callback) {
                    callback(result);
                }
            });
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
                    callback(null);
                }
            };
            if (that.active_party_id) {
                that.deactivateParty(false, activate, callback);
            } else {
                activate();
            }
        },
    });

    partyconnection.ClientConnection = partyconnection.Connection.extend({
        initialize: function () {
            var that = this;
            var That = that.constructor;
            partyconnection.Connection.prototype.initialize.apply(that, arguments);
            that.log("info", "New client connection from " + that.socket.handshake.address.address + ":" + that.socket.handshake.address.port + " user " + that.username + "(" + that.user_id + ")");
            That.addToIndex(that);
            var parties = _.values(parties_per_user[that.user_id] || {});
            _.each(parties, function (party) {that.alertPlusActiveParty(party); });
            that.socket.emit("connection initialized");
        },

        onDisconnect: function () {
            var that = this;
            var That = that.constructor;
            that.log("info", "client connection disconnect");
            That.removeFromIndex(that);
            that.deactivateParty();
        },

        listen: function () {
            var that = this;
            that.setupListen("update token");
            that.setupListen("get my parties");
            that.setupListen("get my party");
            that.setupListen("activate party");
            that.setupListen("propose action");
        },

        "propose action": function (action_data, callback) {
            var that = this;
            if (action_data.party_id !== that.active_party_id) {
                throw "Action is not for the active party";
            }
            if (action_data.user_id !== that.user_id) {
                throw "trying to send an action for another user";
            }
            // we could try to validate the action here, but why would we. Just send it to the master, and let it decide what to do with it
            that.loadParty(that.active_party_id, function (party) {
                var ownerConnection = party.ownerConnection;
                ownerConnection.sendActionData(action_data, function (result) {
                    callback(result);
                });
            });
        },
        "propose action constraints": {
            _TYPE: {_isString: true},
            created: {_isTimestamp: true},
            user_id: {_isNumeric: true},
            party_id: {_isUniqueId: true},
            _strict: false,
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

        alertPlusActiveParty: function (party) {
            var that = this;
            that.socket.emit("plus active party", party.serialize());
        },

        alertMinusActiveParty: function (party) {
            var that = this;
            if (party.id === that.active_party_id) {
                //deactivating a party means deactivating all clients as well
                that.active_party_id = null;
            }
            that.socket.emit("minus active party", party.id);
        },

        alertNewActivePartyAction: function (action) {
            var that = this;
            that.socket.emit("new active party action", action.serialize());
        },

        deactivateParty: function (callback) {
            var that = this;
            var That = that.constructor;
            var party_id = that.active_party_id;
            if (that.active_party_id) {
                that.log("info", "deactivating party " + party_id);
                var party = That.getActivePartyCollection().get(that.active_party_id);
                var action = PM.models.Action.createAction(that.user_id, party, "Leave", {});
                party.ownerConnection.sendAction(action, function (result) {
                    if (result) {
                        that.active_party_id = null;
                        if (callback) {
                            callback();
                        }
                    } else {
                        throw "Leave action failed";
                    }
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
                    var party = That.getActivePartyCollection().get(party_id);
                    if (party) {
                        var action = PM.models.Action.createAction(that.user_id, party, "Join", {});
                        party.ownerConnection.sendAction(action, function (result) {
                            if (result) {
                                that.active_party_id = party_id;
                                if (callback) {
                                    callback(party);
                                }
                            } else {
                                throw "Join action failed";
                            }
                        });
                    } else {
                        if (callback) {
                            callback();
                        }
                    }
                } else {
                    if (callback) {
                        callback();
                    }
                }
            };
            if (that.active_party_id) {
                that.deactivateParty(activate);
            } else {
                activate();
            }
        },

    }, {
        addToIndex: function (clientConnection) {
            var That = this;
            That.clientConnectionIndex = That.clientConnectionIndex || {};
            That.clientConnectionIndex[clientConnection.user_id] = That.clientConnectionIndex[clientConnection.user_id] || [];
            That.clientConnectionIndex[clientConnection.user_id].push(clientConnection);
        },

        removeFromIndex: function (clientConnection) {
            var That = this;
            That.clientConnectionIndex = That.clientConnectionIndex || {};
            That.clientConnectionIndex[clientConnection.user_id] = _.reject(That.clientConnectionIndex[clientConnection.user_id] || [], function (conn) {
                return conn === clientConnection;
            });
        },

        getConnectionsForUserId: function (user_id) {
            var That = this;
            That.clientConnectionIndex = That.clientConnectionIndex || {};
            return That.clientConnectionIndex[user_id] || [];
        },
    });
})();
 
