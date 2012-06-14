/*jslint browser:true, vars: true */
/*globals Ext, SOP*/
"use strict";

/**
 */
Ext.define('SOP.controller.FacebookAuthenticatedController', {
    extend: 'SOP.controller.BaseController',
    requires: ["SOP.domain.FacebookDomain", "SOP.view.FacebookLogin"],

    init: function () {
        SOP.domain.FacebookDomain.init();
        //TODO: set before on all routes
    },

    /**
     * before filter
     */
    checkAndDoFacebookLogin: function (action) {
        this.startLoading();
        SOP.domain.FacebookDomain.isLoggedin(function (loggedin) {
            if (loggedin) {
                action.resume();
            } else {
                SOP.domain.FacebookDomain.callbackOnceLoggedin(function (fb_status) {
                    this.hideLogin();
                    action.resume();
                });
                this.showLogin();
            }
        });
    },

    hideLogin: function () {
        if (Ext.get('login')) {
            Ext.get('login').destroy();
        }
    },


    showLogin: function () {
        this.hideLogin(); //supposedly we could reuse this login component, just no sure how
        Ext.Viewport.add({ xclass: 'SOP.view.FacebookLogin', id: 'login' });
        SOP.domain.FacebookDomain.parseXFBML();
    }
});
