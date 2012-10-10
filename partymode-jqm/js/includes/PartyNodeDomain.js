/*jshint*/
/*global require, exports*/

var root = this;
var _ = root._;
var Toolbox = root.Toolbox;
var Backbone = root.Backbone;
var io = root.io;
var PM = root.PM;

if (typeof exports !== "undefined") {
    /* node */
    if (!_) {_ = require("./underscore"); }
    if (!Toolbox) {Toolbox = require("./toolbox"); }
    if (!Backbone) {Backbone = require("./backbone"); }
    if (!io) {io = require("./sockets.io"); }
    PM = exports;
} else {
    if (!_) {throw "Underscore not loaded"; }
    if (!Toolbox) {throw "Toolbox not loaded"; }
    if (!Backbone) {throw "Backbone not loaded"; }
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
        HOST: "http://tiggr.local:8081/", //TODO research HTTPS

        init: function () {
            var that = this;
            that.socket = io.connect(that.HOST);
            that.socket.on("connect", function () {
                console.log("connect");
                that.trigger("connect"); //TODO: supposedly there is a problem with reconnection, sometimes it blocks
            });
        },

        callbackCatchError: function (callback) {
            return function (result) {
                if (result.error) {
                    throw "An error occured with your call: " + JSON.stringify(result.error);
                }
                if (callback) {
                    callback(result);
                }
            };
        },

        loginAsMaster: function (token, callback) {
            var that = this;
            console.log("loggin in as master");
            that.socket.emit("login", {token: token, master: true}, that.callbackCatchError(function (result) {
                if (!result) {
                    throw "Login failed! " + result;
                } else {
                    callback();
                }
            }));
        },

        createNewParty: function (callback) {
            var that = this;
            that.socket.emit("create new party", null, that.callbackCatchError(callback));
        },

        shareAction: function (action_data, callback) {
            var that = this;
            that.socket.emit("share action", action_data, that.callbackCatchError(callback));
        },
    });
    _.extend(PM.domain.PartyNodeDomain, Backbone.Events);
    PM.domain.PartyNodeDomain.init();
})();
