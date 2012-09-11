/*jslint browser:true, vars: true, plusplus: true,  */
/*globals Ext, SOP, getSpotifyApi*/
"use strict";

/**
 */
Ext.define('SOP.domain.SpotifySpotifyDomain', { //strange name, means domain FOR Spotify interaction, in Spotify app

    inheritableStatics: {
        models: null,

        init: function () {
            var that = this;
            var sp = getSpotifyApi(1);
            that.models = sp.require('sp://import/scripts/api/models');
        },

        search: function (terms, callback) {
            var that = this;
            var search = new that.models.Search(terms, {
                searchAlbums: false,
                searchArtists: false,
                searchPlaylists: false,
                localResults: that.models.LOCALSEARCHRESULTS.IGNORE,
            });
            search.observe(that.models.EVENT.CHANGE, function () {
                callback(Ext.Array.map(search.tracks, function (sptrack) {
                    var data = sptrack.data;
                    data.href = data.uri; // make compatible with web-based api
                    return data;
                }));
            });
            search.appendNext();
        },

        lookup: function (uri, callback) {
            var that = this;
            that.models.Track.fromURI(uri, function (result) {
                console.log("Spotify lookup: ", uri, result.data);
                callback(result.data);
            });
        },
    },
});
