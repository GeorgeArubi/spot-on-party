/*jshint node:true*/

var config = exports;

config.db = {
    host: "ds039027.mongolab.com",
    port: 39027,
    database: "partymode",
    username: "partygoer",
    password: "MqsGNLlP",
    serverOptions: {
        auto_reconnect: true,
    },
    dbOptions: {
        safe: true,
        strict: true,
    }

};
