/*jslint browser:true, vars: true */
/*globals Ext, SOP*/
"use strict";

/**
 */
Ext.define('SOP.domain.AbstractFacebookDomain', {

    inheritableStatics: {
        FACEBOOK_APP_ID: (window.location.host === "tiggr.local" ? "233580756759588" : "312921805471592"), //spotify fb has own id
        FACEBOOK_GRAPH_URL: (window.location.protocol === "http" ? "http:" : "https:") + "//graph.facebook.com/",

        initStarted: false,
        inited: false,
        afterInitCalls: [],
        afterLoginCalls: [],
        fb_status: null,

        /**
         * Load the Facebook Javascript SDK asynchronously, login, call all the functions from afterInitCalls (after the init), and the afterLoginCalls after the login
         * 
         */
        init: function () {
            throw "This is an abstract class, please subclass and override this function";
        },

        callAfterInit: function (func) {
            if (!this.inited) {
                this.afterInitCalls.push(func);
                if (!this.initStarted) {
                    this.init();
                }
            } else {
                func();
            }
        },

        /**
         * note: please don't put functions in here that change the login status.. It will break!
         **/
        callAfterLogin: function (func) {
            var that = this;
            if (that.fb_status.status !== "connected") {
                this.afterLoginCalls.push(func);
                if (!this.initStarted) {
                    this.init();
                }
            } else {
                func();
            }
        },


        isLoggedin: function (callback) {
            this.getLoggedinStatus(function (fb_status) {
                callback(fb_status.status === "connected");
            });
        },

        getLoggedinStatus: function (callback) {
            var that = this;
            this.callAfterInit(function () {
                Ext.defer(function () {callback(that.fb_status); }, 1);
            });
        },

        getAccessToken: function (callback) {
            var that = this;
            that.callAfterLogin(function () {
                callback(that.fb_status.authResponse.accessToken);
            });
        },

        /**
          * Please note: function is synchronous, so will not wait for user_id to arrive. Don't call too early
          */
        getLoggedinUserId: function () {
            var that = this;
            return that.fb_status.authResponse.userID;
        },

        lookupUsers: function (user_ids, callback) {
            var that = this;
            that.getAccessToken(function (accessToken) {
                var params = {ids: user_ids.join(","), fields: "id,name", access_token: accessToken};
                Ext.data.JsonP.request({
                    url: that.FACEBOOK_GRAPH_URL,
                    params: params,
                    callbackKey: "callback",
                    success: function (result, request) {
                        callback(result);
                    }
                });
            });
        },

        getProfilePictureUrl: function (user_id) {
            var that = this;
            return that.FACEBOOK_GRAPH_URL + user_id + "/picture";
        },

        getAllFriends: function (callback) {
            var that = this;
            that.getAccessToken(function (accessToken) {
                var params = {fields: "id,name", access_token: accessToken};
                Ext.data.JsonP.request({
                    url: that.FACEBOOK_GRAPH_URL + "me/friends",
                    params: params,
                    callbackKey: "callback",
                    success: function (result, request) {
                        callback(result.data);
                    }
                });
            });
        },
    },
});