/*jslint vars: true, newcap: true, bitwise:true */
/*global Spotify:true, $, getSpotifyApi */

/**
 * Abstraction for Spotify API
 **/
"use strict";

var Spotify = function (player_change_callback) {
    var init;

    var getTrack;
    var play;
    var getPlaylist;
    var isStoppedOrNotPlayingFromApp;

    var sp;
    var models;

    var playlist;

    init = function () {
        sp = getSpotifyApi(1);
        models = sp.require('sp://import/scripts/api/models');
        models.player.observe(models.EVENT.CHANGE, function (event) {
            if (player_change_callback) {
                if (isStoppedOrNotPlayingFromApp()) {
                    player_change_callback(false, null);
                } else {
                    player_change_callback(models.player.playing, models.player.index);
                }
            }
        });
    };

    getTrack = function (id, callback) {
        models.Track.fromURI(id, callback);
    };

    play = function (song_id, spotify_playlist, spotify_playlist_position) {
        models.player.play(song_id, spotify_playlist, spotify_playlist_position);
    };

    getPlaylist = function () {
        if (!playlist) {
            playlist = new models.Playlist();
        }
        return playlist;
    };

    isStoppedOrNotPlayingFromApp = function () {
        return !(playlist && models.player.context === playlist.uri);
    };

    init();

    return {
        getTrack: getTrack,
        getPlaylist: getPlaylist,
        play: play,
        isStoppedOrNotPlayingFromApp: isStoppedOrNotPlayingFromApp
    };
};