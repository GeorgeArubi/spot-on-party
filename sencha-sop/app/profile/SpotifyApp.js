/*jslint browser:true, vars: true */
/*globals Ext */
"use strict";

/**
 */
Ext.define('SOP.profile.SpotifyApp', {
    extend: "Ext.app.Profile",

    config: {
        name: "SpotifyApp",
    },

    isActive: function () {
        return !!window.getSpotifyApi;
    },

    launch: function () {
        console.log("SposityApp profile activated");
        Ext.syncRequire("SOP.domain.FacebookSpotifyDomain");
    },

});
