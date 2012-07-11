/*jslint browser:true, vars: true */
/*globals Ext, SOP*/
"use strict";

Ext.application({
    name: 'SOP',

    requires: ["Ext.data.Store", ],

    models: ["PlaylistEntry", "User", "Track", "Party"],
    views: ["FacebookLogin", "PlaylistView", "PlaylistEntryView", "AddSongsView", ],
    controllers: [],
    profiles: ["SpotifyApp", "Default"],


    launch: function () {
        if (!this.getRouter().recognize(window.location.hash.substr(1))) {
            window.location.hash = "";
        }
    },

});
