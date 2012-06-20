/*jslint vars: true*/
/*globals Ext, SOP*/
"use strict";

Ext.define("SOP.view.PlaylistView", {
    extend: "Ext.dataview.DataView",

    config: {
        title: "Playlist",
        flex: 1,
        itemTpl: '<div class="playlistname">{[values.track.getNameHtml()]}</div><div class="playlist_artist">{[values.track.getArtistHtml()]}</div><div class="playlist_user_added">{[values.user.getNameHtml()]}</div><button class="playlist_play_btn"><button class="playlist_remove_btn">',
    },

});