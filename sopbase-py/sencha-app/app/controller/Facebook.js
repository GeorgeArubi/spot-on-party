/*jslint browser:true, vars: true */
/*globals Ext, FB, SOP*/
"use strict";

/**
 * Handles Facebook interactions, specifically Login and Logout.
 *
 * When a user logs in, we display their profile picture and a list of Runs.
 */
Ext.define('SOP.controller.Facebook', {
    extend: 'Ext.app.Controller',
    requires: ['Ext.MessageBox', "SOP.controller.Parties"],

    config: {
        control: {
            '#logoutButton': {
                tap: 'logout'
            }
        }
    },

    /**
     * Load the Facebook Javascript SDK asynchronously
     */
    init: function () {

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

    onFacebookInit: function () {
        var that = this;

        if (SOP.app.facebookAppId === '') {
            throw new Error("no facebook app id");
        }

        var onStatusChange = function (response) {
            clearTimeout(that.fbLoginTimeout);
            SOP.authResponse = response.authResponse;
            if (response.authResponse) {
                that.onLogin(response.authResponse);
            } else {
                that.onLogout();
            }
        };

        FB.Event.subscribe('auth.statusChange', onStatusChange);

        FB.init({
            appId  : SOP.app.facebookAppId,
            cookie : false,
            status : false,
        });

        that.fbLoginTimeout = Ext.defer(function () {

            if (Ext.fly('appLoadingIndicator')) {
                Ext.fly('appLoadingIndicator').destroy();
            }

            Ext.create('Ext.MessageBox', {
                title: 'Facebook Error',
                message: [
                    'Facebook Authentication is not responding. ',
                    'Please check your Facebook app is correctly configured, ',
                    'then check the network log for calls to Facebook for more information.',
                    'Restart the app to try again.'
                ].join('')
            }).show();

        }, 10000);

        FB.getLoginStatus(onStatusChange);
    },

    onLogout: function () {
        var that = this;
        Ext.Viewport.setMasked(false);

        if (!Ext.getCmp('login')) {
            Ext.Viewport.add({ xclass: 'SOP.view.Login', id: 'login' });
        }
        Ext.getCmp('login').showLoginText();
    },

    onLogin: function () {
        Ext.create('SOP.view.ChooseParty', {
        }); // will switch to active as soon as it has loaded the parties
    },

    logout: function () {
        Ext.Viewport.setMasked({xtype: 'loadmask', message: 'Logging out...'});
        FB.logout();
    },
});
