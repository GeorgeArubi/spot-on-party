/*jslint browser:true, vars: true */
/*globals Ext, SOP, getSpotifyApi */
"use strict";

/**
 */
Ext.define('SOP.domain.FacebookSpotifyDomain', {
    extend: "SOP.domain.AbstractFacebookDomain",
    alternateClassName: ["SOP.domain.FacebookDomain"],

    inheritableStatics: {
        init: function () {
            var that = this;
            var sp = getSpotifyApi(1);
            var auth = sp.require('sp://import/scripts/api/auth');
            that.initStarted = true;
            auth.authenticateWithFacebook(that.FACEBOOK_APP_ID, [], {
                onSuccess : function (received_accesstoken, ttl) {
                    var params = {fields: "id", access_token: received_accesstoken};
                    Ext.data.JsonP.request({
                        url: that.FACEBOOK_GRAPH_URL + "me",
                        params: params,
                        callbackKey: "callback",
                        success: function (result, request) {
                            that.fb_status = {
                                "status": "connected",
                                "authResponse": {
                                    "accessToken": received_accesstoken,
                                    "expiresIn": ttl,
                                    "userID": result.id
                                },
                            };

                            that.inited = true;
                            Ext.each(that.afterInitCalls, function (func) {
                                func();
                            });
                            that.afterInitCalls = [];
                            Ext.each(that.afterLoginCalls, function (func) {
                                func();
                            });
                            that.afterLoginCalls = [];
                        }
                    });
                },

                onFailure : function (error) {
                    that.fb_status = {
                        "status": "not_authorized",
                    };
                    that.inited = true;
                    Ext.each(that.afterInitCalls, function (func) {
                        func();
                    });
                },

                onComplete : function () { }
            });
        },
    },

});

SOP.domain.FacebookDomain.init();