#!/usr/local/bin/node
/*jshint browser:false, node:true*/

(function () {
    "use strict";
    var _ = require("./includes/underscore");
    var PM = require("./includes/models");
    var https = require("https");
    var winston = require("winston");

    var app = require('express')();
    var server = require('http').createServer(app);
    var io = require('socket.io').listen(server);

    server.listen(8081);

    app.get('/', function (req, res) {
        res.sendfile(__dirname + '/index.html');
    });

    var createClientConnection = function (socket) {
        var that = {};
        that.master = false;
        that.user_id = undefined;

        /* login: {token: xxxx, master(optional): bool} */
        socket.on("login", function (data, callback) {
            if (that.isLoggedin()) {
                throw "Trying to log in again someone else, that can't be right!";
            }
            var token = data.token;
            if (!token.match(/^[A-Za-z0-9]{0,200}$/)) {
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
                    that.user_id = parseInt(object.id, 10);
                    that.master = !!data.master;
                    if (callback) {
                        callback(true);
                    }
                    winston.debug("User \"" + object.name + "\" (" + that.user_id + ") loggedin in" + (that.isMaster() ? " as master":""));
                });

            });
        });

        socket.on("get new party_id", function (undefined, callback) {
            that.requireMaster();
            if (callback) {
                callback(Math.floor(Math.random() * 0xFFFFFFFF));
            }
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

        that.isMaster = function () {
            return !!that.master;
        };

        that.isLoggedin = function () {
            return _.isNumber(that.user_id);
        };
    };

    io.sockets.on('connection', function (socket) {
        createClientConnection(socket);
    });
})();

