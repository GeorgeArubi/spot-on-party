/*jslint vars: true,*/
/*globals Ext, SOP*/
"use strict";

Ext.define("SOP.model.Track", {
    extend: "SOP.model.LazyBaseModel",
    requires: ["Ext.util.Format"],


    statics: {
        /**
          * creates a new object, which will only be loaded in time (or directly if the data is available.
          * fires the "loaded" event once loaded. Please note that the loaded event may be fired multiple times!
          */
        loadLazy: function (track_ids) {
            var that = this;
            return Ext.Array.map(track_ids, function (track_id) {return that.loadLazySingle(track_id); });
        },

        loadLazySingle: function (track_id) {
            var that = this;
            var track = Ext.create(that, {id: track_id});
            if (track.get('loaded')) {
                // loaded from cache
                Ext.defer(function () {track.fireEvent("loaded"); }, 1); //first allow listeners to be attached to object
                return track;
            }
            if (track.get('loading')) {
                //do nothing, already loading
                return track;
            }
            track.set("loading", true);
            SOP.domain.SpotifyDomain.lookup(track_id, function (info) {
                track.set('name', info.name);
                track.set('artist', Ext.Array.map(info.artists, function (artist) {return artist.name; }).join(", "));
                track.set('album', info.album.name);
                track.set('loaded', true);
                track.set("loading", false);
                track.fireEvent("loaded");
            });
            return track;
        },

        /**
          * does a spotify search for these terms, returns song objects
          **/
        search: function (terms, callback) {
            var that = this;
            SOP.domain.SpotifyDomain.search(terms, function (track_infos) {
                callback(Ext.Array.map(track_infos, function (track_info) {
                    var id = track_info.href;
                    var name = track_info.name;
                    var artist = Ext.Array.map(track_info.artists, function (artist) {return artist.name; }).join(", ");
                    var album = track_info.album.name;
                    return Ext.create(that, {id: id, name: name, artist: artist, album: album, loaded: true});
                }));
            });
        },
    },

    config: {
        fields: ["id", "name", "artist", "album", "loaded"],
    },

    getNameHtml: function () {
        var that = this;
        return that.getLazyFieldHtml("name", "----");
    },

    getArtistHtml: function () {
        var that = this;
        return that.getLazyFieldHtml("artist", "----");
    },

});
