/*jslint browser:true */
/*globals Ext, FB, SOP*/
"use strict";

/**
 * Handles Facebook interactions, specifically Login and Logout.
 *
 * When a user logs in, we display their profile picture and a list of Runs.
 */
Ext.define('SOP.controller.Facebook', {
    extend: 'Ext.app.Controller',
    requires: ['Ext.MessageBox'],

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

        if (SOP.app.facebookAppId === '') {return; }

        var me = this;

        FB.init({
            appId  : SOP.app.facebookAppId,
            cookie : true
        });

        FB.Event.subscribe('auth.logout', Ext.bind(me.onLogout, me));

        FB.getLoginStatus(function (response) {

            clearTimeout(me.fbLoginTimeout);

            me.hasCheckedStatus = true;
            Ext.Viewport.setMasked(false);

            Ext.fly('appLoadingIndicator').destroy();

            if (response.status === 'connected') {
                me.onLogin();
            } else {
                me.login();
            }
        });

        me.fbLoginTimeout = Ext.defer(function () {

            Ext.Viewport.setMasked(false);

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
    },

    login: function () {
        Ext.Viewport.setMasked(false);
        var splash = Ext.getCmp('login');
        if (!splash) {
            Ext.Viewport.add({ xclass: 'SOP.view.Login', id: 'login' });
        }
        Ext.getCmp('login').showLoginText();
    },

    onLogin: function () {

        var me = this,
            errTitle;

        FB.api('/me', function (response) {

            if (response.error) {
                FB.logout();

                errTitle = "Facebook " + response.error.type + " error";
                Ext.Msg.alert(errTitle, response.error.message, function () {
                    me.login();
                });
            } else {
                SOP.userData = response;
                if (!me.main) {
                    me.main = Ext.create('SOP.view.ChooseParty', {
                    });
                }
                Ext.Viewport.setActiveItem(me.main);
            }
        });
    },

    logout: function () {
        Ext.Viewport.setMasked({xtype: 'loadmask', message: 'Logging out...'});
        FB.logout();
    },

    /**
     * Called when the Logout button is tapped
     */
    onLogout: function () {

        if (!this.hasCheckedStatus) {return; }

        this.login();

        Ext.Viewport.setMasked(false);
        Ext.Viewport.setActiveItem(Ext.getCmp('login'));
    },
});
