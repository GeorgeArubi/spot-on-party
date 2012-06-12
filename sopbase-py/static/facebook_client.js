/*jslint browser: true, devel: true, vars: true */
/*global Facebook:true, FB, $ */

/**
 * Helper class for Facebook
 **/

"use strict";
var FACEBOOK_APP_ID = '233580756759588';
var MINIMUM_TOKEN_TTL = 10; // allow 10 seconds for transfer latency etc

var FacebookClient = function (login_handler, logout_handler) {
    var init;
    var onlogin;
    var onlogout;
    var getAccessToken;
    var login;
    var logout;

    var accesstoken;
    var accesstokenexpires;

    onlogin = function (authResponse) {
        console.log("login", authResponse);
        accesstoken = authResponse.accessToken;
        accesstokenexpires = new Date();
        accesstokenexpires.setSeconds(accesstokenexpires.getSeconds() + authResponse.expiresIn - MINIMUM_TOKEN_TTL);
        if (login_handler) {
            login_handler();
        }
    };

    onlogout = function () {
        if (logout_handler) {
            logout_handler();
        }
    };

    login = function () {
        FB.login();
    };

    logout = function () {
        FB.logout();
    };

    getAccessToken = function () {
        if (accesstoken && (new Date() < accesstokenexpires)) {
            return accesstoken;
        }
        return null;
    };

    init = function () {
        window.fbAsyncInit = function () {
            FB.Event.subscribe('auth.statusChange', function (response) {
                if (response.authResponse) {
                    onlogin(response.authResponse);
                } else {
                    onlogout();
                }
            });

            FB.init({
                appId      : FACEBOOK_APP_ID,
                status     : true,
                cookie     : false,
                xfbml      : false
            });
        };
        (function (d) {
            var js, id = 'facebook-jssdk';
            if (d.getElementById(id)) {return; }
            js = d.createElement('script');
            js.id = id;
            js.async = true;
            js.src = "//connect.facebook.net/en_US/all.js";
            d.getElementsByTagName('head')[0].appendChild(js);
        }(document));
    };

    init();

    return {
        getAccessToken: getAccessToken,
        login: login,
        logout: logout
    };
};
