/*jshint browser:true, es5:false*/
/*global FB*/

var root = this;
var _ = root._;
var Toolbox = root.Toolbox;
var Backbone = root.Backbone;
var clutils = root.clutils;
var PM = root.PM;

if (!_) {throw "Underscore not loaded"; }
if (!Toolbox) {throw "Toolbox not loaded"; }
if (!Backbone) {throw "Backbone not loaded"; }
if (!clutils) {throw "clutils not loaded"; }
if (!PM) {
    PM = {};
}



(function () {
    "use strict";
    PM.domain.FacebookWebDomain = PM.domain.AbstractFacebookDomain.extend({
        /* instance */
    }, {
        onFacebookInit: function () {
            var that = this;

            FB.init({
                appId  : this.FACEBOOK_APP_ID,
                cookie : false,
                status : false
            });

            FB.getLoginStatus(function (response) {
                var authchange = function (response) {
                    that.fb_status = response;
                    if (response.status === "connected") {
                        _.each(that.afterLoginCalls, function (func) {
                            func();
                        });
                        that.afterLoginCalls = [];
                    }
                };
                FB.Event.subscribe('auth.authResponseChange', authchange);
                authchange(response);

                that.inited = true;
                _.each(that.afterInitCalls, function (func) {
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

            window.fbAsyncInit = _.bind(this.onFacebookInit, this);

            (function (d) {
                var js, id = 'facebook-jssdk';
                if (d.getElementById(id)) {return; }
                js = d.createElement('script');
                js.id = id;
                js.async = true;
                js.src = "//connect.facebook.net/en_US/all.js";
                d.getElementsByTagName('head')[0].appendChild(js);
            })(document);
        }
    });
})();

