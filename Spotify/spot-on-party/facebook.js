/*jslint browser: true, devel: true, vars: true */
/*global Facebook:true, getSpotifyApi */

/**
 * Helper class for Facebook
 * Call Facebook() from the window.fbAsyncInit function
 *
 * Note that initially, either the login_handler or logout_handler will be called
 **/

"use strict";
var FACEBOOK_APP_ID = '450530644974931';
var MINIMUM_TOKEN_TTL = 10; // allow 10 seconds for transfer latency etc

var Facebook = function (login_handler, logout_handler) {
    var init;
    var getAccessToken;

    var accesstoken;
    var accesstokenexpires;

    getAccessToken = function () {
        if (accesstoken && (new Date() < accesstokenexpires)) {
            return accesstoken;
        }
        return null;
    };

    init = function () {
        var sp = getSpotifyApi(1);
        var auth = sp.require('sp://import/scripts/api/auth');

        auth.authenticateWithFacebook(FACEBOOK_APP_ID, [], {
            onSuccess : function (recieved_accesstoken, ttl) {
                accesstoken = recieved_accesstoken;
                accesstokenexpires = new Date();
                accesstokenexpires.setSeconds(accesstokenexpires.getSeconds() + ttl - MINIMUM_TOKEN_TTL);
                login_handler();
                console.log("Logged in user: ", accesstoken, accesstokenexpires);
            },

            onFailure : function (error) {
                accesstoken = null;
                logout_handler();
                console.log("Authentication failed with error: " + error);
            },

            onComplete : function () { }
        });
    };

    init();

    return {
        getAccessToken: getAccessToken
    };
};
