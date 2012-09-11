/*jslint browser:true, vars: true, nomen: true */
/*globals _*/
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
    /* static members */
    init: function () {
        var that = this;
        that.initStarted = true;
        that.fb_status = JSON.parse(localStorage.getItem("fb_status"));
        if (that.fb_status && that.fb_status.status === "connected") {
            // try to see if credentials are still valid
            var params = {fields: "id", access_token: that.fb_status.accesssToken};
            window.$.ajax({
                url: that.FACEBOOK_GRAPH_URL + "me",
                data: params,
                dataType: "jsonp",
                success: function (result, request) {
                    that.inited = true;
                    _.each(that.afterInitCalls, function (func) {
                        func();
                    });
                    that.afterInitCalls = [];
                    if (result.id === that.fb_status.userID) {
                        _.each(that.afterLoginCalls, function (func) {
                            func();
                        });
                        that.afterLoginCalls = [];
                    } else {
                        that.fb_status = {
                            "status": "not_authorized",
                        };
                        localStorage.setItem("fb_status", JSON.stringify(that.fb_status));
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
                var params = {fields: "id,name", access_token: received_accesstoken};
                window.$.ajax({
                    url: that.FACEBOOK_GRAPH_URL + "me",
                    data: params,
                    dataType: "jsonp",
                    success: function (result, request) {
                        that.fb_status = {
                            "status": "connected",
                            "authResponse": {
                                "accessToken": received_accesstoken,
                                "expiresIn": ttl,
                                "userID": result.id,
                                "userName": result.name,
                            },
                        };
                        localStorage.setItem("fb_status", JSON.stringify(that.fb_status));

                        _.each(that.afterLoginCalls, function (func) {
                            func();
                        });
                        that.afterLoginCalls = [];
                        callback();
                    }
                });
            },

            onFailure : function (error) {
                that.fb_status = {
                    "status": "not_authorized",
                };
                localStorage.setItem("fb_status", JSON.stringify(that.fb_status));
                callback();
            },
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
