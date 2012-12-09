/*jshint*/
/*global require, exports*/

var root = this;
var _ = root._;
var Toolbox = root.Toolbox;
var Backbone = root.Backbone;
var clutils = root.clutils;
var io = root.io;
var PM = root.PM;

if (typeof exports !== "undefined") {
    /* node */
    if (!_) {_ = require("./underscore"); }
    if (!Toolbox) {Toolbox = require("./toolbox"); }
    if (!Backbone) {Backbone = require("./backbone"); }
    if (!clutils) {clutils = require("./clutils"); }
    if (!io) {io = require("./sockets.io"); }
    PM = exports;
} else {
    if (!_) {throw "Underscore not loaded"; }
    if (!Toolbox) {throw "Toolbox not loaded"; }
    if (!Backbone) {throw "Backbone not loaded"; }
    if (!clutils) {throw "clutils not loaded"; }
    if (!io) {throw "Sockets.io not loaded"; }
    if (!PM) {
        PM = {};
    }
}



(function () {
    "use strict";
    PM.domain.PartyNodeDomain = Toolbox.Base.extend({
        /* instance */
    }, {
        HOST: "http://tiggr.local:8081/",

        connect: function (token, master, callback) {
            var that = this;
            that.token = token;
            that.master = master;
            var url = that.HOST + '?' + that.buildQueryString();
            that.socket = io.connect(url);
            that.socket.on("connect", function () {
                if (that.activeParty) {
                    that.activateParty(that.activeParty.id);
                }
                that.trigger("connection");
            });
            that.socket.on("plus active party", function (party) {
                that.trigger("plus-active-party", party);
            });
            that.socket.on("minus active party", function (party_id) {
                that.trigger("minus-active-party", party_id);
            });
            that.socket.on("new active party action", function (action_data, callback) {
                that.trigger("new-active-party-action", action_data, callback); //TODO: fix callback issue. Now there is no guarantee that it's called ever, or more than once
            });
            var call_callback = function () {
                console.log("connected to backend");
                that.socket.removeListener("connection initialized", call_callback);
                if (callback) {
                    callback();
                }
            };
            that.socket.on("connection initialized", call_callback);
        },

        buildQueryString: function () {
            var that = this;
            return 'token=' + encodeURIComponent(that.token) + '&master=' + (that.master ? "1" : "0");
        },

        updateToken: function (new_token) {
            var that = this;
            if (new_token !== that.token) {
                that.token = new_token;
                that.buildQueryString();
                that.socket.emit("update token", that.token, that.callbackCatchError());
            }
        },

        activateParty: function (party_id, callback) {
            var that = this;
            if (party_id) {
                that.socket.emit("activate party", party_id, that.callbackCatchError(function (party_data) {
                    var party = PM.models.Party.unserialize(party_data);
                    that.activeParty = party;
                    if (callback) {
                        callback(party);
                    }
                }));
            } else {
                that.socket.emit("activate party", 0, that.callbackCatchError(function () {
                    that.activeParty = null;
                    if (callback) {
                        callback(null);
                    }
                }));
            }
        },

        callbackCatchError: function (callback) {
            return function (result) {
                if (result && result.error) {
                    throw "An error occured with your call: " + JSON.stringify(result.error);
                }
                if (callback) {
                    callback.apply(this, arguments);
                }
            };
        },

        getOwnParties: function (limit, before_timestamp, callback) {
            var that = this;
            return that.getParties("get own parties", limit, before_timestamp, callback);
        },

        getParties: function (method, limit, before_timestamp, callback) {
            var that = this;
            var options = {limit: limit};
            if (clutils.isTimestamp(before_timestamp)) {
                options.before_timestamp = before_timestamp;
            }
            that.socket.emit(method, options, that.callbackCatchError(callback));
        },

        getMyParty: function (party_id, callback) {
            var that = this;
            that.socket.emit("get my party", party_id, that.callbackCatchError(callback));
        },

        getMyParties: function (limit, before_timestamp, callback) {
            var that = this;
            return that.getParties("get my parties", limit, before_timestamp, callback);
        },

        getMyActiveParties: function (callback) {
            var that = this;
            that.socket.emit("get my active parties", null, that.callbackCatchError(callback));
        },

        shareAction: function (action_data, callback) {
            var that = this;
            that.socket.emit("share action", action_data, that.callbackCatchError(callback));
        },

        proposeAction: function (action_data, callback) {
            var that = this;
            that.socket.emit("propose action", action_data, that.callbackCatchError(callback));
        },
    });
    _.extend(PM.domain.PartyNodeDomain, Backbone.Events);
})();
