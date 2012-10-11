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
            searchType: that.models.SEARCHTYPE.SUGGESTION,
        });
        search.observe(that.models.EVENT.CHANGE, function () {
            var datas = _.map(search.tracks, function (sptrack) {
                var data = {
                    _id: sptrack.data.uri,
                    name: sptrack.data.name.decodeForText(),
                    artists: _.map(sptrack.data.artists, function (artist) {return artist.name.decodeForText(); }),
                    album: sptrack.data.album.name.decodeForText(),
                    duration: sptrack.data.duration,
                };
                return data;
            });
            _.delay(function () {callback(datas); }, 0); //calling it in-thread supresses all errors. We do need to copy the results though or they may disappear
        });
        search.appendNext();
    },

    lookup: function (uri, callback) {
        var that = this;
        that.models.Track.fromURI(uri, function (sptrack) {
            var data = {
                _id: sptrack.data.uri,
                name: sptrack.data.name.decodeForText(),
                artists: _.map(sptrack.data.artists, function (artist) {return artist.name.decodeForText(); }),
                album: sptrack.data.album.name.decodeForText(),
                duration: sptrack.data.duration,
            };
            callback(data);
        });
    },
});

window.PM.domain.SpotifySpotifyDomain.init();
