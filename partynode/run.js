#!/usr/local/bin/node
/*jshint browser:false, node:true, nonew:false */

(function () {
    "use strict";

    var app = require('express')();
    var server = require('http').createServer(app);
    var io = require('socket.io').listen(server);
    var domain = require('domain');
    var winston = require("winston");
    var mongodb = require('mongodb');
    var config = require("./config");
    var partyconnection = require("./partyconnection");

    var db_error_domain = domain.create();

    db_error_domain.on("error", function (er) {
        winston.error("Error with database connection: " + er + "\n" + er.stack);
    });


    server.listen(8081);

    app.get('/', function (req, res) {
        res.sendfile(__dirname + '/index.html');
    });

    var mongoServer = new mongodb.Server(config.db.host, config.db.port, config.db.serverOptions);
    var db = new mongodb.Db(config.db.database, mongoServer, config.db.dbOptions);
    db.open(db_error_domain.intercept(function () {
        db.authenticate(config.db.username, config.db.password, db_error_domain.intercept(function (success) {
            if (!success) {
                throw "DB authentication denied";
            }
            var db_collections = {
                actions: new mongodb.Collection(db, "actions"),
            };

            io.set("authorization", partyconnection.Connection.authorize);
            io.sockets.on('connection', function (socket) {
                var connection = new socket.handshake.partynode.ConnectionClass(socket, db_collections, db_error_domain, socket.handshake.partynode);
                connection.listen();
            });

        }));
    }));


})();

