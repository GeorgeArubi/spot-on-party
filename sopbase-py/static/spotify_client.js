/*jslint browser: true, devel: true, vars: true, newcap: true */
/*global Sop:true, Facebook, $, SOPBase, Util, Party, PartyUI */

/**
 * Spotify Library to be used outside of the spotify app
 **/
"use strict";


var SpotifyClient = function (dummy_here_for_compatibility) {
    var init;

    var getTrack;

    getTrack = function (id, callback) {
        $.getJSON("http://ws.spotify.com/lookup/1/.json?uri=" + window.encodeURIComponent(id), function (response) {
            callback(response.track);
        });
    };


    init = function () {

    };

    init();

    return {
        getTrack: getTrack
    };
};