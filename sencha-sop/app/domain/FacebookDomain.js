/*jslint browser:true, vars: true */
/*globals Ext, FB, SOP*/
"use strict";

/**
 */
Ext.define('SOP.domain.FacebookDomain', {
    singleton: true,

    FACEBOOK_APP_ID: "233580756759588",

    initStarted: false,
    inited: false,
    afterInitCalls: [],
    fb_status: null,

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

    onFacebookInit: function () {
        var that = this;

        FB.init({
            appId  : this.FACEBOOK_APP_ID,
            cookie : false,
            status : false,
        });

        FB.getLoginStatus(function (response) {
            that = this;
            var authchange = function (response) {
                that.fb_status = response;
            };
            FB.Event.subscribe('auth.authResponseChange', authchange);
            authchange(response);

            this.inited = true;
            Ext.each(this.afterInitCalls, function (func) {
                var boundFunc = Ext.bind(func, that);
                boundFunc();
            });
            this.afterInitCalls = [];
        });

    },

    /**
     * Load the Facebook Javascript SDK asynchronously
     */
    init: function () {
        this.initStarted = true;

        window.fbAsyncInit = Ext.bind(this.onFacebookInit, this);

        (function (d) {
            var js, id = 'facebook-jssdk';
            if (d.getElementById(id)) {return; }
            js = d.createElement('script');
            js.id = id;
            js.async = true;
            js.src = "//connect.facebook.net/en_US/all.js";
            d.getElementsByTagName('head')[0].appendChild(js);
        }(document));
    },

    /**
     * does a single callback with the fb_status object once loggedin
     **/
    callbackOnceLoggedin: function (callback) {
        var that = this;
        this.callAfterInit(function () {
            if (this.fb_status.status === "connected") {
                Ext.defer(function () {callback(that.fb_status); }, 1);
            } else {
                var event_handler = function (response) {
                    if (response.status === "connected") {
                        //shouldn't be needed, this is what auth.login checks for
                        FB.Event.unsubscribe("auth.login", event_handler);
                        Ext.defer(function () {callback(response); }, 1); //defer so that the other FB event handlers will fire first
                    }
                };
                FB.Event.subscribe("auth.login", event_handler);
            }
        });
    },

    isLoggedin: function (callback) {
        this.getLoginStatus(function (fb_status) {
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
        this.callbackOnceLoggedin(function (fb_status) {
            callback(fb_status.authResponse.accessToken);
        });
    },

    parseXFBML: function () {
        FB.XFBML.parse();
    }
});