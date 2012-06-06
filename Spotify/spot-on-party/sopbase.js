/*jslint browser: true, devel: true, vars: true, newcap: true */
/*global SOPBase:true, $ */

/**
 * Responsible for interaction with the sopbase backend
 **/
"use strict";

var SOPBASE_BACKEND = "http://localhost:8081/";

var SOPBase = function (accesstoken) {
    var init;
    var doCall;

    var createParty;

    doCall = function (methodname, parameters, callback) {
        var defaultparams = {at: accesstoken};
        var url = SOPBASE_BACKEND + "api/1/" + methodname + "?" + $.param($.extend(defaultparams, parameters));
        $.getJSON(url + "&callback=?", function (response) {
            console.log("doCall", url, response);
            callback(response);
        });
    };

    createParty = function (name, invited_friends, callback) {
        doCall("createparty", {name: name, invited_friends: invited_friends.join(",")}, callback);
    };

    init = function () {
    };

    return {
        createParty: createParty
    };
};
