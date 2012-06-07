/*jslint vars: true, newcap: true, bitwise:true */
/*global Spotify:true, $, getSpotifyApi */

/**
 * Abstraction for Spotify API
 **/
"use strict";

var Spotify = function () {
    var init;
    var getTrack;

    var sp;
    var models;

    init = function () {
        sp = getSpotifyApi(1);
        models = sp.require('sp://import/scripts/api/models');
    };

    getTrack = function (id, callback) {
        models.Track.fromURI(id, callback);
    };

    init();

    return {
        getTrack: getTrack
    };
};