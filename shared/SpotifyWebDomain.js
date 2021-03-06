/*jshint browser:true, es5:false*/
/*global */

var root = this;
var _ = root._;
var Toolbox = root.Toolbox;
var Backbone = root.Backbone;
var clutils = root.clutils;
var PM = root.PM;
var $ = root.$;

if (!_) {throw "Underscore not loaded"; }
if (!Toolbox) {throw "Toolbox not loaded"; }
if (!Backbone) {throw "Backbone not loaded"; }
if (!clutils) {throw "clutils not loaded"; }
if (!$) {throw "jQuery not loaded"; }
if (!PM) {
    PM = {};
}

(function () {
    "use strict";
    PM.domain.SpotifyWebDomain = Toolbox.Base.extend({
        /* instance */
    }, {
        CALL_DELAY: 150, //nr of ms between calls to spotify API -- rate limited on 10/sec, so we do 7/sec just to be sure
        LOOKUP_URL: "http://ws.spotify.com/lookup/1/.json",
        SEARCH_TRACK_URL: "http://ws.spotify.com/search/1/track.json",
        SEARCH_ALBUM_URL: "http://ws.spotify.com/search/1/album.json",
        SEARCH_ARTIST_URL: "http://ws.spotify.com/search/1/artist.json",

        lastcallTime: 0,
        callQueue: [],
        queueTimer: null,
        counter: 0,
    
        search: function (terms, callback) {
            var that = this;
            return that.searchhelper(terms, that.SEARCH_TRACK_URL, "tracks", _.bind(that.copyUsefulTrackData, that), callback);
        },

        searchArtist: function (terms, callback) {
            var that = this;
            return that.searchhelper(terms, that.SEARCH_ARTIST_URL, "artists", _.bind(that.copyUsefulTrackData, that), callback);
        },

        searchAlbum: function (terms, callback) {
            var that = this;
            return that.searchhelper(terms, that.SEARCH_ALBUM_URL, "albums", _.bind(that.copyUsefulAlbumData, that), callback);
        },

        searchhelper: function (terms, url, key, resultformatter, callback) {
            var that = this;
            var params = {q: terms};
            that.counter++;
            that.callQueue.push({url: url, params: params, callback: function (result) {
                callback(_.map(result[key], resultformatter));
            }, counter: that.counter});
            that.handleQueue();
            return that.counter;
        },

        lookup: function (uri, callback) {
            var that = this;
            var params = {uri: uri};
            that.counter++;
            that.callQueue.push({url: that.LOOKUP_URL, params: params, callback: function (result) {callback(that.copyUsefulTrackData(result.track)); }, counter: that.counter});
            that.handleQueue();
            return that.counter;
        },

        copyUsefulAlbumData: function (spalbum) {
            return {
                _id: spalbum.id,
                name: spalbum.name,
                artists: _.map(spalbum.artists, function (artist) {return artist.name; })
            };
        },

        copyUsefulTrackData: function (sptrack) {
            return {
                _id: sptrack.href,
                name: sptrack.name,
                artists: _.map(sptrack.artists, function (artist) {return artist.name; }),
                album: sptrack.album.name,
                albumcover: null,
                duration: sptrack.length * 1000 //make ms, because this is what the spotifyspotifydomain does
            };
        },

        handleQueue: function () {
            var that = this;
            if (this.callQueue.length === 0) {
                return;
            }
            var now = (new Date()).valueOf();
            var wait = that.lastcallTime + this.CALL_DELAY - now;
            if (wait > 0) {
                window.clearTimeout(this.queueTimer);
                this.queueTimes = _.delay(_.bind(that.handleQueue, that), wait);
                return;
            }
            that.lastcallTime = now;
            var call = that.callQueue.splice(0, 1)[0]; // this pops one item off the callqueue top
            $.getJSON(
                call.url,
                call.params,
                function (data) {
                    call.callback(data);
                }
            );
        },

        init: function () {}
    });
    PM.domain.SpotifyWebDomain.init();
})();
