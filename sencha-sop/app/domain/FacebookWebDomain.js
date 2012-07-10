/*jslint browser:true, vars: true */
/*globals SOP, Ext, FB */
"use strict";

/**
 */
Ext.define('SOP.domain.FacebookWebDomain', {
    extend: "SOP.domain.AbstractFacebookDomain",
    alternateClassName: ["SOP.domain.FacebookDomain"],

    inheritableStatics: {
        onFacebookInit: function () {
            var that = this;

            FB.init({
                appId  : this.FACEBOOK_APP_ID,
                cookie : false,
                status : false,
            });

            FB.getLoginStatus(function (response) {
                var authchange = function (response) {
                    that.fb_status = response;
                    if (response.status === "connected") {
                        Ext.each(that.afterLoginCalls, function (func) {
                            func();
                        });
                        that.afterLoginCalls = [];
                    }
                };
                FB.Event.subscribe('auth.authResponseChange', authchange);
                authchange(response);

                that.inited = true;
                Ext.each(that.afterInitCalls, function (func) {
                    func();
                });
                that.afterInitCalls = [];
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
    },
});

SOP.domain.FacebookDomain.init();
