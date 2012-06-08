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
    var removeSong;
    var playPosition;

    doCall = function (methodname, parameters, callback) {
        var defaultparams = {at: accesstoken, sp: 1};
        var url = SOPBASE_BACKEND + "api/1/" + methodname + "?" + $.param($.extend(defaultparams, parameters));
        $.getJSON(url + "&callback=?", function (response) {
            console.log("doCall", url, response);
            if (callback) {
                callback(response);
            }
        });
    };

    createParty = function (name, invited_friends, callback) {
        doCall("createparty", {name: name, invited_user_ids: invited_friends.join(",")}, callback);
    };

    removeSong = function (party_id, position, callback) {
        doCall("removesong", {party_id: party_id, position: position}, callback);
    };

    playPosition = function (party_id, position, callback) {
        doCall("playposition", {party_id: party_id, position: position}, callback);
    };

    init = function () {
    };

    return {
        createParty: createParty,
        removeSong: removeSong,
        playPosition: playPosition
    };
};
