/*jslint browser:true, vars: true */
/*globals Ext, SOP*/
"use strict";

Ext.application({
    name: 'SOP',

    requires: ["Ext.data.Store", ],

    models: ["PlaylistEntry", "User", "UserInParty", "Track", "Party"],
    views: ["FacebookLogin",
            "PlaylistView", "PlaylistEntryView", "AddSongsView",
            "UserlistView", "UserlistEntryView", "InviteUsersView",
           ],
    controllers: [],
    profiles: ["SpotifyApp", "Default"],


    launch: function () {
        SOP.domain.FacebookDomain.init();
        SOP.domain.SpotifyDomain.init();
        if (!this.getRouter().recognize(window.location.hash.substr(1))) {
            window.location.hash = "";
        }
    },

});
