/*jshint browser:true, globalstrict: true */
/*global _*/
"use strict";

if (!window.PM) {
    window.PM = {};
}
if (!window.PM.domain) {
    window.PM.domain = {};
}
/**
 */
window.PM.domain.FacebookSpotifyDomain = window.PM.domain.AbstractFacebookDomain.extend({
    /* instance members */
}, {
    FACEBOOK_APP_ID: "312921805471592", //spotify fb has own id
    /* static members */
    init: function () {
        var that = this;
        that.initStarted = true;
        that.fb_status = JSON.parse(localStorage.getItem("fb_status"));
        if (that.fb_status && that.fb_status.status === "connected") {
            if (that.authenticationAlmostExpires()) {
                that.extendAccessToken();
            }
            // try to see if credentials are still valid
            var params = {fields: "id", access_token: that.fb_status.authResponse.accessToken};
            window.$.ajax({
                url: that.FACEBOOK_GRAPH_URL + "me",
                data: params,
                dataType: "jsonp",
                success: function (result, /* request */ undefined) {
                    if (result.id && result.id === that.fb_status.authResponse.userID) {
                        that.inited = true;
                        _.each(that.afterInitCalls, function (func) {
                            func();
                        });
                        that.afterInitCalls = [];
                        
                        _.each(that.afterLoginCalls, function (func) {
                            func();
                        });
                        that.afterLoginCalls = [];
                    } else {
                        that.fb_status = {
                            "status": "not_authorized",
                        };
                        localStorage.setItem("fb_status", JSON.stringify(that.fb_status));
                        that.extendAccessToken(function () {
                            that.inited = true;
                            _.each(that.afterInitCalls, function (func) {
                                func();
                            });
                            that.afterInitCalls = [];
                        });
                    }
                },
            });
        } else {
            that.inited = true;
            _.each(that.afterInitCalls, function (func) {
                func();
            });
            that.afterInitCalls = [];
            that.fb_status = {
                "status": "not_authorized",
            };
            localStorage.setItem("fb_status", JSON.stringify(that.fb_status));
        }
    },

    showLoginPopup: function (callback) {
        var that = this;
        var sp = window.getSpotifyApi(1);
        var auth = sp.require('sp://import/scripts/api/auth');
        auth.authenticateWithFacebook(that.FACEBOOK_APP_ID, [], {
            onSuccess : function (received_accesstoken, ttl) {
                var params = {fields: "id", access_token: received_accesstoken};
                window.$.ajax({
                    url: that.FACEBOOK_GRAPH_URL + "me",
                    data: params,
                    dataType: "jsonp",
                    success: function (result, /* request */ undefined) {
                        that.fb_status = {
                            "status": "connected",
                            "authResponse": {
                                "accessToken": received_accesstoken,
                                "expiresOn": (new Date().valueOf()) + ttl * 1000,
                                "userID": result.id,
                            },
                        };
                        localStorage.setItem("fb_status", JSON.stringify(that.fb_status));

                        _.each(that.afterLoginCalls, function (func) {
                            func();
                        });
                        that.afterLoginCalls = [];
                        if (callback) {
                            callback();
                        }
                    }
                });
            },

            onFailure : function (/* error */ undefined) {
                that.fb_status = {
                    "status": "not_authorized",
                };
                localStorage.setItem("fb_status", JSON.stringify(that.fb_status));
                callback();
            },
        });
    },

    extendAccessToken: function (callback) {
        var that = this;
        that.showLoginPopup(function () {
            that.trigger("new token", that.fb_status.authResponse.accessToken);
            if (callback) {
                callback();
            }
        });
    },

    logout: function () {
        var that = this;
        that.fb_status = {
            "status": "not_authorized",
        };
        localStorage.setItem("fb_status", JSON.stringify(that.fb_status));
        //TODO: should probably tell facebook to kill my token.....
    }
});
