/*jslint vars: true, newcap: true, bitwise:true */
/*global Party:true, window, $ */

/**
 * Abstraction of a Party. The party is fed with actions, and it's this classes responsibilty to keep a consistant view of the party
 **/
"use strict";

var Party = function (id, owner_id, spotify, command_callback) {
    var init;

    /**
     * recalculates the party for the indicated position; assumes that all previous parties are correct
     * returns {changed: bitword with the items that have been changed}
     */
    var recalculateParty;

    /**
     * feeds one action
     */
    var feed;

    /**
     * gets the most recent party
     */
    var getPartyInfo;
    var getSpotifyPlaylist;
    /**
      * returns the position an item will have in the spotify playlist, considering its position in the song_id list
      **/
    var getSpotifyPlaylistPositionFromPartyInfoPosition;
    var getPartyInfoPositionFromSpotifyPlaylistPosition;
    /**
      * makes sure the spotify playlist is in sync with the party song_ids. This will be an expensive operation if the discrepancy is somewhere in the start of the playlist
      **/
    var synchronizeSpotifyPlaylist;

    var spotify_playlist;

    var doCommandCallback;

    /**
     * array, each entry containing an action, and the resulting party-state
     */
    var party_log;

    init = function () {
        party_log = [{action: {id: 0}, party: {
            id: id,
            owner_id: owner_id,
            name: "",
            invited_user_ids: {},
            joined_user_ids: {},
            song_ids: [],
            state: Party.STATE_OFF
        }}];
        spotify_playlist = spotify.getPlaylist();
    };

    doCommandCallback = function (command, parameters) {
        window.setTimeout(function () {
            command_callback(command, parameters);
        }, 1);
    };

    getSpotifyPlaylist = function () {
        return spotify_playlist;
    };

    getSpotifyPlaylistPositionFromPartyInfoPosition = function (position) {
        var spotify_playlist_position = 0, i, song_ids = getPartyInfo().song_ids;
        if (!song_ids[position]) {
            //track has been removed, has no spotify playlist position
            return null;
        }
        for (i = 0; i < position; i += 1) {
            if (song_ids[i]) {
                spotify_playlist_position += 1;
            }
        }
        return spotify_playlist_position;
    };

    getPartyInfoPositionFromSpotifyPlaylistPosition = function (spotify_playlist_position) {
        var position = -1, i = -1, song_ids = getPartyInfo().song_ids;
        do {
            position += 1;
            while (song_ids[position] === null) {
                position += 1;
            }
            if (position >= song_ids.length) {
                //weird, but better return something...
                return null;
            }
            i += 1;
        } while (i < spotify_playlist_position);
        return position;
    };

    recalculateParty = function (position, is_new) {
        //assert: position > 0
        var action = party_log[position].action;
        var party = $.extend(true, {}, party_log[position - 1].party); //deep copy
        party_log[position].party = party;
        var changed = 0;
        switch (action.type) {
        case "PartyCreateAction":
            party.state = Party.STATE_ON;
            party.name = action.name;
            changed |= Party.NAME | Party.PLAY_STATUS;
            break;
        case "PartyChangeNameAction":
            party.name = action.name;
            changed |= Party.NAME;
            break;
        case "PartyInviteAction":
            party.invited_user_ids[action.invited_user_id] = action.created;
            changed |= Party.PARTY_GOERS;
            break;
        case "PartyKickAction":
            delete party.invited_user_ids[action.kicked_user_id];
            delete party.joined_user_ids[action.kicked_user_id];
            changed |= Party.PARTY_GOERS;
            break;
        case "PartyJoinedAction":
            party.joined_user_ids[action.user_id] = action.created;
            changed |= Party.PARTY_GOERS;
            break;
        case "PartyLeftAction":
            delete party.joined_user_ids[action.user_id];
            changed |= Party.PARTY_GOERS;
            break;
        case "PartySongAddAction":
            party.song_ids.push(action.song_id);
            changed |= Party.PLAYLIST;
            doCommandCallback(Party.COMMAND_PLAY_IF_STOPPED, {position: party.song_ids.length - 1});
            break;
        case "PartySongRemoveAction":
            var spotify_playlist_position = getSpotifyPlaylistPositionFromPartyInfoPosition(action.position);
            party.song_ids[action.position] = null;
            if (spotify_playlist_position !== null) {
                spotify_playlist.remove(spotify_playlist_position); //this may be incorrect if actions don't arrive in order; in that case it will get fixed in the end
                console.log("removing at index", spotify_playlist_position)
            }
            changed |= Party.PLAYLIST;
            doCommandCallback(Party.COMMAND_NEXT_IF_POSITION, {position: action.position});
            break;
        case "PartyPositionPlayAction":
            if (is_new) {
                doCommandCallback(Party.COMMAND_PLAY_POSITION, {position: action.position});
            }
            break;
        case "PartyPlayAction":
            if (is_new) {
                doCommandCallback(Party.COMMAND_PLAY);
            }
            break;
        case "PartyPauseAction":
            if (is_new) {
                doCommandCallback(Party.COMMAND_PAUSE);
            }
            break;
        case "PartyOnAction":
            party.state = Party.STATE_ON;
            changed |= Party.PLAY_STATUS;
            break;
        case "PartyOffAction":
            party.state = Party.STATE_OFF;
            changed |= Party.PLAY_STATUS;
            doCommandCallback(Party.COMMAND_STOP);
            break;
        default:
            console.log("Don't know how to handle action type " + action.type + " at position " + position, party_log);
            throw "Don't know how to handle action type " + action.type;
        }
        return changed;
    };

    feed = function (action) {
        var insert_spot = party_log.length, i;
        while (action.id < party_log[insert_spot - 1].action.id) {
            insert_spot -= 1;
        }
        if (party_log[insert_spot] && action.id === party_log[insert_spot].action.id) {
            return; //already fed
        }
        party_log.splice(insert_spot, 0, {action: action});
        for (i = insert_spot; i < party_log.length; i += 1) {
            recalculateParty(i, i === insert_spot);
        }
        synchronizeSpotifyPlaylist();
    };

    getPartyInfo = function () {
        return party_log[party_log.length - 1].party;
    };

    synchronizeSpotifyPlaylist = function () {
        var song_id_position = 0, spotify_playlist_position = 0, song_ids = getPartyInfo().song_ids;
        var track_ids = $.map(spotify_playlist.tracks, function (track) {return track.uri; });
        while (true) {
            while (song_ids[song_id_position] === null) {
                song_id_position += 1;
            }
            if (song_id_position > song_ids.length || spotify_playlist_position > track_ids.length || song_ids[song_id_position] !== track_ids[spotify_playlist_position]) {
                break;
            }
            if (song_ids[song_id_position] === track_ids[spotify_playlist_position]) {
                song_id_position += 1;
                spotify_playlist_position += 1;
            }
        }
        console.log("broke at", song_id_position, spotify_playlist_position, song_ids, track_ids)
        //remove extra entries from spotify playlist
        while (spotify_playlist_position < spotify_playlist.length) {
            spotify_playlist.remove(spotify_playlist.length - 1);
            console.log("removing from playlist")
        }
        //add extra entries from song_ids
        while (song_id_position < song_ids.length) {
            if (song_ids[song_id_position] !== null) {
                console.log("adding to playlist")
                spotify_playlist.add(song_ids[song_id_position]);
            }
            song_id_position += 1;
        }
    };

    init();

    return {
        feed: feed,
        getPartyInfo: getPartyInfo,
        getSpotifyPlaylist: getSpotifyPlaylist,
        getSpotifyPlaylistPositionFromPartyInfoPosition: getSpotifyPlaylistPositionFromPartyInfoPosition,
        getPartyInfoPositionFromSpotifyPlaylistPosition: getPartyInfoPositionFromSpotifyPlaylistPosition
    };

};

Party.PLAYLIST = 1 << 0;
Party.PLAY_STATUS = 1 << 1;
Party.PARTY_GOERS = 1 << 2;
Party.NEWSFEED = 1 << 3;
Party.NAME = 1 << 4;

Party.STATE_OFF = 1;
Party.STATE_ON = 2;

Party.COMMAND_PLAY = 1;
Party.COMMAND_PAUSE = 2;
Party.COMMAND_STOP = 3;
Party.COMMAND_PLAY_IF_STOPPED = 4;
Party.COMMAND_PLAY_POSITION = 5;
Party.COMMAND_NEXT_IF_POSITION = 6; // proceed to the next song if currently playing this position


