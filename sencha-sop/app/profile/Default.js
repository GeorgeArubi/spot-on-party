/*jslint browser:true, vars: true */
/*globals Ext */
"use strict";

/**
 */
Ext.define('SOP.profile.Default', {
    extend: "Ext.app.Profile",

    config: {
        name: "Default",
    },

    isActive: function () {
        return true;
    },

    launch: function () {
        console.log("Default profile activated");
        Ext.syncRequire("SOP.domain.FacebookWebDomain");
    },

});
