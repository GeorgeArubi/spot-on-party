/*jshint*/
/*global require, exports*/

var root = this;
var _ = root._;
var Toolbox = root.Toolbox;
var io = root.io;
var PM = root.PM;

if (typeof exports !== "undefined") {
    /* node */
    if (!_) {_ = require("./underscore"); }
    if (!Toolbox) {Toolbox = require("./toolbox"); }
    if (!io) {io = require("./sockets.io"); }
    PM = exports;
} else {
    if (!_) {throw "Underscore not loaded"; }
    if (!Toolbox) {throw "Toolbox not loaded"; }
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
        },

        callbackCatchError: function (callback) {
            return function (result) {
                if (result.error) {
                    throw "An error occured with your call: " + result.error;
                }
                if (callback) {
                    callback(result);
                }
            };
        },

        loginAsMaster: function (token, callback) {
            var that = this;
            that.socket.emit("login", {token: token, master: true}, that.callbackCatchError(function (result) {
                if (!result) {
                    throw "Login failed! " + result;
                } else {
                    callback();
                }
            }));
        },

        getNewPartyId: function (callback) {
            var that = this;
            that.socket.emit("get new party_id", null, that.callbackCatchError(callback));
        },
    });
    PM.domain.PartyNodeDomain.init();
})();
