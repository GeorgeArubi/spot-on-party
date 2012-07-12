/*jslint browser:true, vars: true, plusplus: true,  */
/*globals Ext, SOP, getSpotifyApi*/
"use strict";

/**
 * This class does the integration between the actual spotify app (the one that plays the music), and the SOP app
 */

Ext.define("SOP.domain.SpotifyAppIntegrator", {
    inheritableStatics: {
        activeParty: null, // the party that is currently being "run"; that is in front in the interface
        models: null,
        spotifyPlaylist: null,

        init: function () {
            var that = this;
            var sp = getSpotifyApi(1);
            that.models = sp.require('sp://import/scripts/api/models');

            that.models.player.observe(that.models.EVENT.CHANGE, function (event) {
                if (that.isStoppedOrNotPlayingFromApp()) {
                    that.onPartyPlayStopped();
                } else {
                    that.onPartyPlayStarted(that.models.player.index);
                }
            });

            SOP.app.getController("SOP.controller.spotifyapp.PartyController").on("activateparty", that.onActivateParty, that);
            SOP.app.getController("SOP.controller.spotifyapp.PartyController").on("deactivateparty", that.onDeactivateParty, that);
        },

        onDeactivateParty: function (party) {
            var that = this;
            if (party !== that.activeParty) {
                return;
            }
            console.log("Party is inactive now");
            party.un("fed", that.onPartyFed, that);
            party.un("commands", that.onPartyCommands, that);
            if (!that.isStoppedOrNotPlayingFromApp()) {
                that.models.player.playing = false; //pauses; I would prefer stop for now, but this is fine!
            }
            that.activeParty = null;
        },

        onActivateParty: function (party) {
            var that = this;
            if (that.activeParty) {
                that.onDeactivateParty(that.activeParty);
            }
            console.log("Party is active now");
            that.spotifyPlaylist = new that.models.Playlist();

            party.on("fed", function () {that.syncPartyPlaylist(party); });
            party.on("commands", that.onPartyCommands, that);
            that.syncPartyPlaylist(party);
            that.activeParty = party;
        },

        isStoppedOrNotPlayingFromApp: function () {
            var that = this;
            return (that.models.player.context !== that.spotifyPlaylist.uri);
        },

        syncPartyPlaylist: function (party) {
            var that = this;
            //first throw out any deleted items
            var i;
            var tracks = that.spotifyPlaylist.tracks;
            var newPlaylistEntries = party.getPartyState().playlist_entries.filter(function (playlistEntry) {
                return !playlistEntry.get('deleted');
            });
            var newPlayIndex = null;
            var isRunning = !that.isStoppedOrNotPlayingFromApp();
            var newItemsStartAt = that.spotifyPlaylist.length;
            i = 0;
            while (i < tracks.length) {
                if (newPlaylistEntries[i].get('track').get('id') === tracks[i].uri) {
                    i++;
                } else {
                    if (isRunning && i === SOP.domain.SpotifyAppIntegrator.models.player.index) {
                        newPlayIndex = i;
                    }
                    tracks.splice(i, 1);
                    that.spotifyPlaylist.remove(i);
                    newItemsStartAt--;
                }
            }
            for (i = that.spotifyPlaylist.length; i < newPlaylistEntries.length; i++) {
                that.spotifyPlaylist.add(newPlaylistEntries[i].get('track').get('id'));
            }
            if (newPlayIndex !== null && newPlayIndex < newPlaylistEntries.length) {
                that.models.player.play(that.spotifyPlaylist.tracks[newPlayIndex].uri, that.spotifyPlaylist, newPlayIndex);
            } else if (!isRunning && newItemsStartAt < newPlaylistEntries.length) {
                that.models.player.play(that.spotifyPlaylist.tracks[newItemsStartAt].uri, that.spotifyPlaylist, newItemsStartAt);
            }
        },

        onPartyCommands: function (commands) {
            var that = this;
            var i;
            var playing = null;
            var index = null;
            var party = that.activeParty;
            var playlistEntries = party.getPartyState().playlist_entries.filter(function (playlistEntry) {
                return !playlistEntry.get('deleted');
            });
            Ext.each(commands, function (command) {
                switch (command.type) {
                case "play":
                    playing = true;
                    break;
                case "pause":
                    playing = false;
                    break;
                case "playposition":
                    for (i = 0; i < playlistEntries.length; i++) {
                        if (playlistEntries[i].get('position') >= command.position) {
                            // note: using greater_or_equal, so that if was removed, first next song gets played
                            break;
                        }
                    }
                    if (i < playlistEntries.length) { // else somehow we need to play a song that isn't there yet (or was deleted right after play command...). Perhaps we should try again in a moment, or perhaps just not care and ignore the race condition
                        playing = true;
                        index = i;
                    }
                    break;
                default:
                    throw "Unknown command type: " + command.type;
                }
            });
            if (index !== null) {
                that.models.player.play(that.spotifyPlaylist.tracks[index].uri, that.spotifyPlaylist, index);
            }
            if (playing !== null) {
                that.models.player.playing = playing;
            }
        },

        onPartyPlayStopped: function () {
            var that = this;
            var party = that.activeParty;
            SOP.domain.SopBaseDomain.updatePlayStatus(party.get('id'),
                                                      false,
                                                      -1,
                                                      0,
                                                      function (actions) {party.feed(actions); });
        },
        onPartyPlayStarted: function () {
            var that = this;
            var party = that.activeParty;
            var playlistEntries = party.getPartyState().playlist_entries.filter(function (playlistEntry) {
                return !playlistEntry.get('deleted');
            });
            SOP.domain.SopBaseDomain.updatePlayStatus(party.get('id'),
                                                      that.models.player.playing,
                                                      playlistEntries[that.models.player.index].get('position'),
                                                      that.models.player.position,
                                                      function (actions) {party.feed(actions); });
        },
    },
});