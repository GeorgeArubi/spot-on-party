/*jshint browser:true, globalstrict: true */
/*global _,$*/
"use strict";

if (!window.PM) {
    window.PM = {};
}
if (!window.PM.domain) {
    window.PM.domain = {};
}

/**
 * This class does the integration between the actual spotify app (the one that plays the music), and the SOP app
 */
window.PM.domain.SpotifyAppIntegrator = window.Toolbox.Base.extend({
}, {
    init: function () {
        var that = this;
        var sp = window.getSpotifyApi(1);
        that.models = sp.require('sp://import/scripts/api/models');
        that.models.player.observe(that.models.EVENT.CHANGE, _.bind(that.onPlayerEvent, that));

        that.views = sp.require('sp://import/scripts/api/views');
        that.myTrackView = function (undefined) {
            that.views.Track.apply(this, arguments);

            var addedby = $("<span>");
            this.node.appendChild(addedby[0]);
            var willplayat = $("<span>");
            willplayat.addClass("expectedplaytime");
            this.node.appendChild(willplayat[0]);
            _.delay(_.bind(function () {
                var index = $(this.node).prevAll().length;
                var playlist = that.activeParty.get("playlist");
                var track_in_playlist = playlist.at(index);
                addedby.text(track_in_playlist.get("user").get("name"));

            }, this), 1);
            that.throttledUpdateExpectedPlayTimes();
        };
        that.myTrackView.prototype = that.views.Track.prototype;
    },

    throttledUpdateExpectedPlayTimes: _.debounce(function () {
        var that = this;
        that.updateExpectedPlayTimes();
    }, 1),

    updateExpectedPlayTimes: function () {
        var that = this;
        var expectedplaytimes = $('#playlist-placeholder .expectedplaytime');
        
        switch (that.activeParty.get("play_status")) {
        case "stop":
            expectedplaytimes.text("");
            break;
        case "pause":
            $(expectedplaytimes.slice(0, that.models.player.index)).text("");
            $(expectedplaytimes.slice(that.models.player.index + 1)).text("---");
            break;
        case "play":
            var waitms = 0;
            that.activeParty.get("playlist").each(function (track_in_playlist) {
                if (track_in_playlist.isDeleted()) {
                    return;
                }
                var position_in_spotify_playlist = track_in_playlist.get("position_in_spotify_playlist");
                if (position_in_spotify_playlist < that.models.player.index) {
                    $(expectedplaytimes[position_in_spotify_playlist]).text("");
                    return;
                }
                var playsat = new Date(that.activeParty.get("current_place_in_track").valueOf() + waitms);
                waitms += track_in_playlist.get("track").get("duration");
                if (position_in_spotify_playlist === that.models.player.index) {
                    $(expectedplaytimes[position_in_spotify_playlist]).text("");
                    return;
                }
                var timetext = playsat.getHours() + ":" + (playsat.getMinutes() < 10 ? "0" : "") + playsat.getMinutes();
                $(expectedplaytimes[position_in_spotify_playlist]).text(timetext);
            });
            break;
        default:
            throw "don't like default values!";
        }
    },

    onPlayerEvent: _.debounce(function () { //multiple events being fired as once, better debounce and set the status settle
        var that = this;
        if (that.isStoppedOrNotPlayingFromApp()) {
            that.onPartyPlayStopped();
        } else {
            that.onPartyPlayStarted(that.models.player.index);
        }
        that.updateExpectedPlayTimes();
    }, 50),

    stopParty: function (party) {
        var that = this;
        if (party !== that.activeParty) {
            return;
        }
        console.log("Party is inactive now");
        if (!that.isStoppedOrNotPlayingFromApp()) {
            that.models.player.playing = false; //pauses; I would prefer stop for now, but this is fine!
        }
        party.off("playcommand", that.onPlayCommand, that);
        party.get("playlist").off("add", that.addPlaylistItem, that);
        party.get("playlist").off("remove", that.deletePlaylistItem, that);
        that.activeParty = null;
    },

    startPartyReturnHtmlNode: function (party) {
        var that = this;
        if (that.activeParty) {
            throw "Can't start new party, old party " + that.activeParty.id + " is still running";
        }
        console.log("Party is active now");
        that.activeParty = party;

        party.on("playcommand", that.onPlayCommand, that);
        party.get("playlist").on("add", that.addPlaylistItem, that);
        party.get("playlist").on("remove", that.deletePlaylistItem, that);

        that.createAndFillPlaylistFromParty();
        return (new that.views.List(that.spotifyPlaylist, function (track) {return new that.myTrackView(track); })).node;
    },

    isStoppedOrNotPlayingFromApp: function () {
        var that = this;
        return (that.models.player.context !== that.spotifyPlaylist.uri);
    },

    createAndFillPlaylistFromParty: function () {
        var that = this;
        that.spotifyPlaylist = new that.models.Playlist();
        _.each(that.activeParty.get("playlist"), function (track_in_playlist) {
            if (!track_in_playlist.isDeleted()) {
                that.addPlaylistItem(track_in_playlist);
            }
        });
    },

    addPlaylistItem: function (track_in_playlist) {
        var that = this;
        track_in_playlist.set("position_in_spotify_playlist", that.spotifyPlaylist.length, {silent: true});
        that.spotifyPlaylist.add(track_in_playlist.get("track").id);
        var track = _.last(that.spotifyPlaylist.tracks);
        track.data.addedByUser = track_in_playlist.get("user");
    },

    deletePlaylistItem: function (track_in_playlist) {
        var that = this;
        var position = track_in_playlist.get("position_in_spotify_playlist");
        that.spotifyPlaylist.splice(position, 1);
        _.each(that.activeParty.get("playlist"), function (other_track_in_playlist) {
            var otherPosition = other_track_in_playlist.get("position_in_spotify_playlist");
            if (_.isNumber(otherPosition) && otherPosition > position) {
                other_track_in_playlist.set("position_in_spotify_playlist", otherPosition - 1, {silent: true});
            }
        });
        track_in_playlist.set("position_in_spotify_playlist", undefined, {silent: true});
        that.spotifyPlaylist.add(track_in_playlist.get("track").id);

    },

    onPlayCommand: function (command, argument) {
        var that = this;
        switch (command) {
        case "play":
            if (_.isNumber(argument)) {
                var track_in_playlist = that.activeParty.get("playlist").at(argument);
                var position_to_play = track_in_playlist.get("position_in_spotify_playlist");
                that.models.player.play(track_in_playlist.get("track").id, that.spotifyPlaylist, position_to_play);
            } else {
                that.models.player.playing = true;
            }
            break;
        case "pause":
            that.models.player.playing = false;
            break;
        case "play_next":
            that.models.player.next();
            break;
        default:
            throw "Not sure how to handle command: " + command;
        }
    },

    getCurrentPartyPlaylistIndex: function () {
        var that = this;
        var spotifyPlaylistIndex = that.models.player.index;
        var partyPlaylist = that.activeParty.get("playlist");
        var i;
        for (i = 0; i < partyPlaylist.length; i++) {
            if (partyPlaylist.at(i).get("position_in_spotify_playlist") === spotifyPlaylistIndex) {
                return i;
            }
        }
        return -1;
    },

    onPartyPlayStopped: function () {
        var that = this;
        that.activeParty.applyPlayStatusFeedback("stop", -1, 0);
    },

    onPartyPlayStarted: function () {
        var that = this;
        if (that.models.player.playing) {
            that.activeParty.applyPlayStatusFeedback("play",
                                                     that.getCurrentPartyPlaylistIndex(),
                                                     new Date(new Date().valueOf() - that.models.player.position)
                                                    );
        } else {
            that.activeParty.applyPlayStatusFeedback("pause",
                                                     that.getCurrentPartyPlaylistIndex(),
                                                     that.models.player.position
                                                    );
        }
    },
});

window.PM.domain.SpotifyAppIntegrator.init();
