/*jshint browser:true, globalstrict: true */
/*global _,$,clutils*/
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
        var stopDeleteButtonsFromSelectingTrack = _.debounce(function () {
            $('#playlist-placeholder .delete-button').mousedown(function (event) {event.stopPropagation(); });
        }, 1);

        that.views = sp.require('sp://import/scripts/api/views');
        that.myTrackView = function (track) {
            /*jshint bitwise:false */
            that.views.Track.call(this, track,
                             that.views.Track.FIELD.STAR
                                 | that.views.Track.FIELD.SHARE
                                 | that.views.Track.FIELD.NAME
                                 | that.views.Track.FIELD.ARTIST);

            /*jshint bitwise:true */

            var addedby = $("<span>");
            addedby.addClass("addedby");
            this.node.appendChild(addedby[0]);
            var willplayat = $('<span><span class="play-time"></span><span class="delete-button"><span class="delete">delete</span></span></span>');
            willplayat.addClass("expectedplaytime");
            this.node.appendChild(willplayat[0]);
            _.delay(_.bind(function () {
                var index = $(this.node).prevAll().length;
                var playlist = that.activeParty.get("playlist");
                var track_in_playlist = playlist.at(index);
                $(".delete-button", willplayat).prop("tip_number", track_in_playlist.get("tip_number"));
                track_in_playlist.getUser().onLoaded(function (user) {
                    addedby.text(user.getName(that.activeParty));
                });
                track_in_playlist.getTrack().onLoaded(_.bind(that.updateExpectedPlayTimes, that));
            }, this), 0);
            stopDeleteButtonsFromSelectingTrack();
        };
        that.myTrackView.prototype = that.views.Track.prototype;
        that.shuffle = false;
        that.repeat = false;
    },

    updateExpectedPlayTimes: _.debounce(function () {
        var that = this;
        if (that.updateExpectedPlayTimesTimer) {
            clearTimeout(that.updateExpectedPlayTimesTimer);
        }
        that.updateExpectedPlayTimesTimeout = 100;
        var toExecute = function () {
            that.updateExpectedPlayTimesTimer = setTimeout(toExecute, that.updateExpectedPlayTimesTimeout);
            that.updateExpectedPlayTimesTimeout *= 4;
            that.updateExpectedPlayTimesWorker();
        };
        toExecute();
    }, 1),

    updateExpectedPlayTimesWorker: function () {
        var that = this;
        if (!that.activeParty) {
            //party has ended, but for some reason timer has survived...
            return;
        }
        var expectedplaytimes = $('#playlist-placeholder .expectedplaytime .play-time');
        
        switch (that.activeParty.get("play_status")) {
        case "stop":
            expectedplaytimes.text("");
            break;
        case "pause":
        case "play":
            var targetms;
            that.activeParty.get("playlist").each(function (track_in_playlist, index) {
                if (that.shuffle || index < that.models.player.index) {
                    $(expectedplaytimes[index]).prop("expectedtime", null);
                    return;
                }
                if (index === that.models.player.index) {
                    if (that.activeParty.get("play_status") === "play") {
                        targetms = that.activeParty.get("current_place_in_track") + track_in_playlist.getTrack().get("duration");
                    } else { //pause
                        targetms = clutils.nowts() + track_in_playlist.getTrack().get("duration") - that.activeParty.get("current_place_in_track");
                    }
                    $(expectedplaytimes[index]).prop("expectedtime", null);
                    return;
                }
                $(expectedplaytimes[index]).prop("expectedtime", targetms);
                targetms += track_in_playlist.getTrack().get("duration");
            });
            if (!that.shuffle && that.repeat) { //when repeating, songs at the top have an expected time as well
                that.activeParty.get("playlist").each(function (track_in_playlist, index) {
                    if (index < that.models.player.index) {
                        $(expectedplaytimes[index]).prop("expectedtime", targetms);
                        targetms += track_in_playlist.getTrack().get("duration");
                        return;
                    }
                });
            }
            that.updateExpectedPlayTimesView(true);
            break;
        default:
            throw "don't like default values!";
        }
    },

    updateExpectedPlayTimesView: function (even_if_paused) {
        var that = this;
        var expectedplaytimes = $('#playlist-placeholder .expectedplaytime .play-time');
        if (even_if_paused || that.activeParty.get("play_status") === "play") {
            _.each(expectedplaytimes, function (el) {
                if (!clutils.isTimestamp(el.expectedtime)) {
                    el.innerText = "";
                } else {
                    var waitms = el.expectedtime - clutils.nowts();
                    $(el).text(clutils.formatTimeMs(waitms));
                }
            });
        }
    },

    onPlayerEvent: _.debounce(function () { //multiple events being fired as once, better debounce and let the status settle
        var that = this;
        if (!that.activeParty) {
            console.log("can't update any player status if I don't know what party I am");
            return;
        }
        if (that.isStoppedOrNotPlayingFromApp()) {
            that.onPartyPlayStopped();
        } else {
            that.onPartyPlayStarted(that.models.player.index);
        }
        if (that.models.player.repeat !== that.repeat) {
            that.repeat = that.models.player.repeat;
            $('body').toggleClass("player-repeat", that.repeat);
        }
        if (that.models.player.shuffle !== that.shuffle) {
            that.shuffle = that.models.player.shuffle;
            $('body').toggleClass("player-shuffle", that.shuffle);
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

        window.clearInterval(that.updateTimesInterval);
        party.off("playcommand", that.onPlayCommand, that);
        party.get("playlist").off("add", that.addPlaylistItem, that);
        party.get("playlist").off("remove", that.removePlaylistItem, that);
        party.get("playlist").off("reset", that.onResetPlaylist, that);
        that.activeParty = null;
    },

    startParty: function (party) {
        var that = this;
        if (that.activeParty) {
            throw "Can't start new party, old party " + that.activeParty.id + " is still running";
        }
        console.log("Party is active now");
        that.activeParty = party;

        party.on("playcommand", that.onPlayCommand, that);
        party.get("playlist").on("add", that.addPlaylistItem, that);
        party.get("playlist").on("remove", that.removePlaylistItem, that);
        party.get("playlist").on("reset", that.onResetPlaylist, that);

        that.updateTimesInterval = window.setInterval(_.bind(that.updateExpectedPlayTimesView, that), 500);
        that.createAndFillPlaylistFromParty();
    },
    
    getHtmlNodeForActivePlaylist: function () {
        var that = this;
        that.list = new that.views.List(that.spotifyPlaylist, function (track) {return new that.myTrackView(track); });
        return that.list.node;
    },

    getPlaylistDomForOldPartyPage: function (party) {
        var that = this;
        var tracks_in_playlist = party.get("playlist");
        var playlist = new that.models.Playlist();
        tracks_in_playlist.each(function (track_in_playlist) {playlist.add(track_in_playlist.get("track_id")); });
        return (new that.views.List(playlist)).node;
    },

    addPartyAsPlaylist: function (party) {
        var that = this;
        var tracks_in_playlist = party.get("playlist");
        var playlist = new that.models.Playlist(party.get("name"));
        tracks_in_playlist.each(function (track_in_playlist) {playlist.add(track_in_playlist.get("track_id")); });
        return playlist;
    },


    isStoppedOrNotPlayingFromApp: function () {
        var that = this;
        return (!that.spotifyPlaylist || that.models.player.context !== that.spotifyPlaylist.uri);
    },

    createAndFillPlaylistFromParty: function () {
        var that = this;
        that.spotifyPlaylist = new that.models.Playlist();
        that.activeParty.get("playlist").each(function (track_in_playlist) {
            that.addPlaylistItem(track_in_playlist);
        });
    },

    addPlaylistItem: function (track_in_playlist) {
        var that = this;
        that.spotifyPlaylist.add(track_in_playlist.get("track_id"));
    },

    removePlaylistItem: function (track_in_playlist, playlist, options) {
        var that = this;
        that.spotifyPlaylist.remove(options.index);
    },

    onResetPlaylist: function () {
        var that = this;
        var i, playlist = that.activeParty.get("playlist");
        for (i = 0; i < playlist.length; i++) {
            if (i >= that.spotifyPlaylist.length || playlist.at(i).get("track_id") !== that.spotifyPlaylist.get(i).uri) {
                break;
            }
        }
        while (i > that.spotifyPlaylist.length) {
            that.spotifyPlaylist.remove(i);
        }
        for (; i < playlist.length; i++) {
            that.spotifyPlaylist.add(playlist.at(i).get("track_id"));
        }
        that.spotifyPlaylist.notify(that.models.EVENT.CHANGE);
    },

    onPlayCommand: function (command, tip_number) {
        var that = this;
        switch (command) {
        case "play":
            if (_.isNumber(tip_number)) {
                var track_in_playlist = that.activeParty.findTrackInPlaylistByTipNumber(tip_number);
                that.play(that.activeParty.get("playlist").indexOf(track_in_playlist));
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

    play: function (index) {
        var that = this;
        that.models.player.play(that.spotifyPlaylist.tracks[index], that.spotifyPlaylist, index);
    },

    onPartyPlayStopped: function () {
        var that = this;
        if (that.activeParty.get("current_tip_number") !== -1 || that.activeParty.get("play_status") !== "stop") {
            that.activeParty.applyPlayStatusFeedback("stop", -1, 0);
        }
    },

    onPartyPlayStarted: function () {
        var that = this;
        var tip_number = that.activeParty.get("playlist").at(that.models.player.index).get("tip_number");
        if (that.models.player.playing) {
            that.activeParty.applyPlayStatusFeedback("play",
                                                     tip_number,
                                                     clutils.nowts() - that.models.player.position
                                                    );
        } else {
            that.activeParty.applyPlayStatusFeedback("pause",
                                                     tip_number,
                                                     that.models.player.position
                                                    );
        }
    },
});

window.PM.domain.SpotifyAppIntegrator.init();
