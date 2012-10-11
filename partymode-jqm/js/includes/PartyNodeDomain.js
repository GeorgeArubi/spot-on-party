/*jshint browser: true*/
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

        connect: function (token, master) {
            var that = this;
            that.token = token;
            that.master = master;
            var url = that.HOST + '?' + that.buildQueryString();
            that.socket = io.connect(url);
            that.socket.on("connect", function () {
                console.log("connected to backend");
            });
        },

        buildQueryString: function () {
            var that = this;
            return 'token=' + encodeURIComponent(that.token) + '&master=' + (that.master ? 1 : 0);
        },

        updateToken: function (new_token) {
            var that = this;
            if (new_token !== that.token) {
                that.token = new_token;
                that.socket.socket.options.query = that.buildQueryString();
                that.socket.emit("update token", that.token, that.callbackCatchError());
            }
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

        shareAction: function (action_data, callback) {
            var that = this;
            that.socket.emit("share action", action_data, that.callbackCatchError(callback));
        },
    });
    _.extend(PM.domain.PartyNodeDomain, Backbone.Events);
})();
