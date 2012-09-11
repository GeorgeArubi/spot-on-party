/*jslint browser:true, vars: true, nomen: true */
/*globals _*/
"use strict";

if (!window.PM) {
    window.PM = {};
}
if (!window.PM.domain) {
    window.PM.domain = {};
}

window.PM.domain.AbstractFacebookDomain = window.Toolbox.Base.extend({
    /*instance members*/
}, {
    /*static members*/
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
        var that = this;
        if (!that.inited) {
            that.afterInitCalls.push(func);
            if (!that.initStarted) {
                that.init();
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
            window.setTimeout(function () {callback(that.fb_status); }, 1);
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

    /**
     * Please note: function is synchronous, so will not wait for user_id to arrive. Don't call too early
     */
    getLoggedinUserName: function () {
        var that = this;
        return that.fb_status.authResponse.userName;
    },

    lookupUsers: function (user_ids, callback) {
        var that = this;
        that.getAccessToken(function (accessToken) {
            var params = {ids: user_ids.join(","), fields: "id,name", access_token: accessToken};
            window.$.ajax({
                url: that.FACEBOOK_GRAPH_URL,
                data: params,
                dataType: "jsonp",
                success: function (result, textStatus) {
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
            window.$.ajax({
                url: that.FACEBOOK_GRAPH_URL + "me/friends",
                data: params,
                dataType: "jsonp",
                success: function (result, textStatus) {
                    callback(result.data);
                }
            });
        });
    },
});