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
            var willplayat = $('<span><span class="play-time"></span><span class="delete-button"><span class="delete">skip song</span><span class="undelete">don\'t skip</span></span></span>');
            willplayat.addClass("expectedplaytime");
            this.node.appendChild(willplayat[0]);
            $(_.toArray(this.node.childNodes).slice(0, 4)).append('<hr class="strike">');
            _.delay(_.bind(function () {
                var index = $(this.node).prevAll().length;
                var playlist = that.activeParty.get("playlist");
                var track_in_playlist = playlist.at(index);
                if (track_in_playlist.isDeleted()) {
                    $(addedby.parent()).addClass("deleted");
                    $(addedby.parent()).removeClass("sp-track-selected");
                    track_in_playlist.getDeletedByUser().onLoaded(function (user) {
                        addedby.text("song skipped by: " + user.get("name"));
                    });
                } else {
                    track_in_playlist.getUser().onLoaded(function (user) {
                        addedby.text(user.get("name"));
                    });
                }
                track_in_playlist.getTrack().onLoaded(_.bind(that.updateExpectedPlayTimes, that));

            }, this), 0);
            stopDeleteButtonsFromSelectingTrack();
        };
        that.myTrackView.prototype = that.views.Track.prototype;
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
                if (track_in_playlist.isDeleted()) {
                    return;
                }
                if (index < that.models.player.index) {
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
        party.get("playlist").off("change:deleted_by_user_id", that.onChangePlaylistItem, that);
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
        party.get("playlist").on("change:deleted_by_user_id", that.onChangePlaylistItem, that);
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
        var tracks_in_playlist = party.getNotDeletedTracksInPlaylist();
        var playlist = new that.models.Playlist();
        _.each(tracks_in_playlist, function (track_in_playlist) {playlist.add(track_in_playlist.get("track_id")); });
        return (new that.views.List(playlist)).node;
    },

    addPartyAsPlaylist: function (party) {
        var that = this;
        var tracks_in_playlist = party.getNotDeletedTracksInPlaylist();
        var playlist = new that.models.Playlist(party.get("name"));
        _.each(tracks_in_playlist, function (track_in_playlist) {playlist.add(track_in_playlist.get("track_id")); });
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

    onChangePlaylistItem: function () {
        var that = this;
        that.spotifyPlaylist.notify(that.models.EVENT.CHANGE);
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

    onPlayCommand: function (command, index) {
        var that = this;
        switch (command) {
        case "play":
            if (_.isNumber(index)) {
                that.play(index);
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
        if (that.activeParty.get("current_playlist_index") !== -1 || that.activeParty.get("play_status") !== "stop") {
            that.activeParty.applyPlayStatusFeedback("stop", -1, 0);
        }
    },

    onPartyPlayStarted: function () {
        var that = this;
        if (that.models.player.playing && that.activeParty.get("playlist").at(that.models.player.index).isDeleted()) {
            var delta;
            if (that.spotifyPlaylist.length > 2 && that.models.player.index + 1 === that.lastPlayedIndex) {
                delta = -1;
            } else {
                delta = 1;
            }
            var index_to_play = that.models.player.index;
            var looped = false;
            while (that.activeParty.get("playlist").at(index_to_play).isDeleted()) {
                index_to_play += delta;
                if (index_to_play < 0) {
                    //we're going backwards, so play first one that is playable
                    delta = 1;
                    index_to_play = that.models.player.index;
                }
                if (index_to_play >= that.spotifyPlaylist.length) {
                    index_to_play = 0;
                    if (looped) {
                        //all hope is lost, playlist is empty of songs to play. let's just stop
                        break;
                    } else {
                        //don't give up hope, let's try from the start to find an item to select
                        looped = true;
                    }
                }
            }
            that.play(index_to_play);
            if (looped) { //if looped, we stop
                _.delay(function () {
                    that.models.player.playing = false;
                }, 1); //for some reason this needs to be called asynchronously
            }
            return;
        }
        that.lastPlayedIndex = that.models.player.index;
        if (that.models.player.playing) {
            that.activeParty.applyPlayStatusFeedback("play",
                                                     that.models.player.index,
                                                     clutils.nowts() - that.models.player.position
                                                    );
        } else {
            that.activeParty.applyPlayStatusFeedback("pause",
                                                     that.models.player.index,
                                                     that.models.player.position
                                                    );
        }
    },
});

window.PM.domain.SpotifyAppIntegrator.init();
