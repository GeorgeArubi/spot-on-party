/*jslint vars:true, bitwise:true, plusplus: true  */
/*globals Ext, SOP*/
"use strict";

Ext.define("SOP.model.Party", {
    extend: "Ext.data.Model",
    requires: ["SOP.model.Track", "SOP.model.User", "SOP.model.PlaylistEntry", "SOP.domain.SopBaseDomain", "Ext.Array"],

    config: {
        playlistEntryStore: Ext.create("Ext.data.Store", {
            model: "SOP.model.PlaylistEntry",
            data: [],
            sorters: [{property: "position", direction: "ASC"}],
            listeners: {
                // this is needed because the playlistentry contains other objects, and in those cases the stores don't
                // get notified of the update
                addrecords: function (store, records) {
                    var that = this;
                    Ext.each(records, function (playlistEntry) {
                        var storeInteface = {
                            afterEdit: function () { store.afterEdit(playlistEntry, ['track', 'user'], {}); },
                            afterCommit: function () { },
                            afterErase: function () { },
                        };
                        playlistEntry.get('track').join(storeInteface);
                        playlistEntry.get('user').join(storeInteface);
                    });
                }
            }
        }),
        fields: [
            'id',
            "name",
            "active",
            "owner_id",
            {
                name: "log",
                defaultValue: [
                    {
                        action: {type: null},
                        party_state: {
                            owner_id: null,
                            name: null,
                            invited_user_ids: {},
                            joined_user_ids: {},
                            playlist_entries: [],
                            active: 1, //ACTIVE_OFF, can't use static yes because it hasn't been defined yet
                        }
                    }
                ],
            },
        ],
    },

    statics: {
        test: 0,
        loadActivePartiesForLoggedinUser: function (callback) {
            var that = this;
            SOP.domain.SopBaseDomain.getActiveParties(function (party_infos) {
                callback(Ext.Array.map(party_infos, function (party_info) {
                    return Ext.create(that, party_info);
                }));
            });
        },
        /**
         * loads a single party (when party is not active or loggedin user is not invited "null" is returned
         * afterwards starts following the party, by retrieving 
         */
        loadActiveAndFollow: function (party_id, callback) {
            var that = this;
            var followParty = function (party) {
                //TODO: set up the channel here
                party.getAndFeedActions(function () {
                    callback(party);
                });
            };
            var cachedParty =  Ext.data.Model.cache[Ext.data.Model.generateCacheId(that.getName(), party_id)];
            if (cachedParty) {
                var party = Ext.create(that, {}, party_id);
                followParty(party);
            } else {
                SOP.domain.SopBaseDomain.getParty(party_id, function (party_info) {
                    if (!party_info) {
                        callback(null);
                        return;
                    }
                    var party = Ext.create(that, party_info);
                    if (!party.get('active')) {
                        callback(null);
                        return;
                    }
                    followParty(party);
                });
            }
        },

        ACTIVE_OFF: 1,
        ACTIVE_ON: 2,
        CHANGE_NAME: 1 << 0,
        CHANGE_ACTIVE: 1 << 1,
        CHANGE_INVITED: 1 << 2,
        CHANGE_JOINED: 1 << 3,
        CHANGE_PLAYLIST: 1 << 4,
        CHANGE_NEWSFEED: 1 << 5,
    },

    toUrl: function () {
        return "party/" + this.get('id');
    },

    /**
     * tells us up until where we've recieved all actions
     */
    calculateLastActionId: function () {
        var party_log = this.get('log'), i;
        for (i = 1; i < party_log.length; i++) {
            if (!party_log[i]) {
                break;
            }
        }
        return i - 1;
    },

    getAndFeedActions: function (callback) {
        var that = this;
        SOP.domain.SopBaseDomain.getActions(this.get('id'), this.calculateLastActionId(), function (actions) {
            that.feed(actions);
            if (callback) {
                callback();
            }
        });
    },

    getPartyState: function () {
        var party_log = this.get('log');
        return party_log[party_log.length - 1].party_state;
    },

    feed: function (actions) {
        var party_log = this.get('log'), lowest_changed = party_log.length + 1, i, new_items = {};
        Ext.Array.each(actions, function (action) {
            if (party_log[action.nr]) {
                return; //already fed
            }
            party_log[action.nr] = {action: action};
            new_items[action.nr] = true;
            lowest_changed = Math.min(lowest_changed, action.nr);
        });
        this.set('log', party_log);
        for (i = lowest_changed; i < party_log.length; i++) {
            this.recalculateParty(i, !!new_items[i]);
        }
        var party_state = this.getPartyState();
        if (this.get('name') !== party_state.name) {
            this.set('name', party_state.name);
            this.fireEvent("namechanged");
        }
        this.set('active', (party_state.active === this.self.ACTIVE_ON));
        this.set('owner_id', party_state.owner.get('id'));
    },

    recalculateParty: function (position, is_new) {
        //assert: position > 0
        var party_log = this.get('log');
        var action = party_log[position].action;
        var party_state = Ext.clone(party_log[position - 1].party_state);
        party_log[position].party_state = party_state;
        var changed = 0;
        switch (action.type) {
        case "PartyCreateAction":
            party_state.active = this.self.ACTIVE_ON;
            party_state.name = action.name;
            party_state.owner = SOP.model.User.loadLazy([action.user_id])[0];
            changed |= this.self.CHANGED_NAME | this.self.CHANGED_ACTIVE;
            break;
        case "PartyChangeNameAction":
            party_state.name = action.name;
            changed |= this.self.CHANGED_NAME;
            break;
        case "PartyInviteAction":
            party_state.invited_user_ids[action.user_id] = {invited_user: SOP.model.User.loadLazy([action.invited_user_id])[0], created: action.created};
            changed |= this.self.CHANGED_INVITED;
            break;
        case "PartyKickAction":
            delete party_state.invited_user_ids[action.kicked_user_id];
            changed |= this.self.CHANGED_INVITED;
            if (party_state.joined_users[action.kicked_user_id]) {
                delete party_state.joined_users[action.kicked_user_id];
                changed |= this.self.CHANGED_JOINED;
            }
            break;
        case "PartyJoinedAction":
            party_state.joined_users[action.user_id] = {user: SOP.model.User.loadLazy([action.user_id])[0], created: action.created};
            changed |= this.self.CHANGED_INVITED;
            break;
        case "PartyLeftAction":
            delete party_state.joined_user_ids[action.user_id];
            changed |= this.self.CHANGED_JOINED;
            break;
        case "PartySongAddAction":
            var playlist_entry = Ext.create("SOP.model.PlaylistEntry", {
                id: this.get('id') + "_" + action.nr, //makes sure that the object is reused and updated if it already exists
                track: SOP.model.Track.loadLazy([action.song_id])[0],
                user: SOP.model.User.loadLazy([action.user_id])[0],
                created: action.created,
                deleted: null,
                deleted_by_user: null,
                position: party_state.playlist_entries.length,
            });
            party_state.playlist_entries.push(playlist_entry);
            if (is_new) {
                //add the record to the store
                this.getPlaylistEntryStore().add(playlist_entry);
            }
            changed |= this.self.CHANGED_PLAYLIST;
            /*
            if (is_new) {
                doCommandCallback(Party.COMMAND_PLAY_IF_STOPPED, {position: party.song_ids.length - 1});
            }*/
            break;
        case "PartySongRemoveAction":
            party_state.playlist_entries[action.position].set({
                deleted_by_user: SOP.model.User.loadLazy([action.user_id])[0],
                deleted: action.created,
            });
            changed |= this.self.CHANGED_PLAYLIST;
            /*
            if (is_new) {
              doCommandCallback(Party.COMMAND_NEXT_IF_POSITION, {position: action.position});
            */
            break;
        case "PartyPositionPlayAction":
            /*
            if (is_new) {
                doCommandCallback(Party.COMMAND_PLAY_POSITION, {position: action.position});
            }
            */
            break;
        case "PartyPlayAction":
            /*
            if (is_new) {
                doCommandCallback(Party.COMMAND_PLAY);
            }
            */
            break;
        case "PartyPauseAction":
            /*
            if (is_new) {
                doCommandCallback(Party.COMMAND_PAUSE);
            }
            */
            break;
        case "PartyOnAction":
            party_state.active = this.self.ACTIVE_ON;
            changed |= this.self.CHANGED_ACTIVE;
            break;
        case "PartyOffAction":
            party_state.active = this.self.ACTIVE_OFF;
            changed |= this.self.CHANGED_ACTIVE;
            /*
            if (is_new) {
                doCommandCallback(Party.COMMAND_STOP);
            }
            */
            break;
        default:
            console.log("Don't know how to handle action type " + action.type + " at position " + position, party_log);
            throw "Don't know how to handle action type " + action.type;
        }
        this.set('log', party_log);
        return changed;
    },

});
