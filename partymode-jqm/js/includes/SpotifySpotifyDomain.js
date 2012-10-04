/*jshint browser:true, globalstrict: true */
/*global _*/
"use strict";

if (!window.PM) {
    window.PM = {};
}
if (!window.PM.domain) {
    window.PM.domain = {};
}

window.PM.domain.SpotifySpotifyDomain = window.Toolbox.Base.extend({ //strange name, means domain FOR Spotify interaction, in Spotify app
    /*instance members*/
}, {
    /*static members */
    init: function () {
        var that = this;
        var sp = window.getSpotifyApi(1);
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
            callback(_.map(search.tracks, function (sptrack) {
                var data = sptrack.data;
                data.href = data.uri; //make results inline with web api
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
});

window.PM.domain.SpotifySpotifyDomain.init();
