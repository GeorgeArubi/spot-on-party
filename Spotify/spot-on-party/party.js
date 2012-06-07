/*jslint vars: true, newcap: true, bitwise:true */
/*global Party:true */

/**
 * Abstraction of a Party. The party is fed with actions, and it's this classes responsibilty to keep a consistant view of the party
 **/
"use strict";

var Party = function (id, owner_id) {
    var init;

    /**
     * recalculates the party for the indicated position; asumed that all previous parties are correct
     * returns as bitword the items that have been changed
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

    /**
     * array, each entry containing an action, and the resulting party-state
     */
    var party_log;

    init = function () {
        party_log = [{action: {id: 0}, party: {id: id, owner_id: owner_id, name: "", invited_user_ids: {}, joined_user_ids: {}, song_ids: [], currently_playing_id: -1, state: Party.STATE_UNKOWN}}];
    };

    recalculateParty = function (position) {
        //assert: position > 0
        var action = party_log[position].action;
        var party = party_log[position - 1].party;
        var changed = 0;
        switch (action.type) {
        case "PartyCreateAction":
            party.state = Party.STATE_PAUSED;
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
            break;
        case "PartySongRemoveAction":
            party.song_ids[action.position] = null;
            changed |= Party.PLAYLIST;
            break;
        case "PartyStartPlayAction":
            party.state = Party.STATE_PLAY;
            party.currently_playing_id = action.position;
            changed |= Party.PLAY_STATUS;
            break;
        case "PartyPauseAction":
            party.state = Party.STATE_PAUSE;
            changed |= Party.PLAY_STATUS;
            break;
        case "PartyOnAction":
            party.state = Party.STATE_PAUSE;
            changed |= Party.PLAY_STATUS;
            break;
        case "PartyOffAction":
            party.state = Party.STATE_OFF;
            changed |= Party.PLAY_STATUS;
            break;
        default:
            console.log("Don't know how to handle action type " + action.type + " at position " + position, party_log);
            throw "Don't know how to handle action type " + action.type;
        }
        party_log[position].party = party;
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
            recalculateParty(i);
        }
    };

    getPartyInfo = function () {
        return party_log[party_log.length - 1].party;
    };

    init();

    return {
        feed: feed,
        getPartyInfo: getPartyInfo
    };

};

Party.PLAYLIST = 1 << 0;
Party.PLAY_STATUS = 1 << 1;
Party.PARTY_GOERS = 1 << 2;
Party.NEWSFEED = 1 << 3;
Party.NAME = 1 << 4;

Party.STATE_UNKNOWN = 1;
Party.STATE_PAUSED = 2;
Party.STATE_PLAYING = 3;
Party.STATE_OFF = 1;
