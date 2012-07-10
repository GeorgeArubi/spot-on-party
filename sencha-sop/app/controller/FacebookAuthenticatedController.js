/*jslint browser:true, vars: true, sloppy: true, forin: true */
/*globals Ext, SOP*/

/**
 */
Ext.define('SOP.controller.FacebookAuthenticatedController', {
    extend: 'SOP.controller.BaseController',
    requires: ["SOP.view.FacebookLogin"],

    init: function () {
        this.callParent(arguments);
        //set before on all routes
        var routes = this.getRoutes(), path;
        var before = this.getBefore();
        for (path in routes) {
            var method = routes[path];
            if (!before[method]) {
                before[method] = [];
            }
            before[method].push("checkAndDoFacebookLogin");
        }
        this.setBefore(before);
    },

    /**
     * before filter
     */
    checkAndDoFacebookLogin: function (action) {
        var that = this;
        this.startLoading();
        SOP.domain.FacebookDomain.isLoggedin(function (loggedin) {
            if (loggedin) {
                action.resume();
            } else {
                SOP.domain.FacebookDomain.callAfterLogin(function () {
                    that.hideLogin();
                    action.resume();
                });
                that.showLogin();
            }
        });
    },

    hideLogin: function () {
        if (Ext.getCmp('login')) {
            Ext.getCmp('login').destroy();
        }
    },


    showLogin: function () {
        this.hideLogin(); //supposedly we could reuse this login component, just no sure how
        Ext.Viewport.add({ xclass: 'SOP.view.FacebookLogin', id: 'login' });
        this.stopLoading();
    }
});
