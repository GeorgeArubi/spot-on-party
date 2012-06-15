/*jslint sloppy: true, plusplus:true, vars:true, bitwise:true, plusplus: true  */
/*globals Ext, SOP*/

Ext.define("SOP.model.Party", {
    extend: "Ext.data.Model",
    requires: ["SOP.model.Track", "SOP.domain.SopBaseDomain", "Ext.Array"],

    config: {
        fields: [ 'id', "name", "owner_id", "log"],
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
        ACTIVE_OFF: 1,
        ACTIVE_ON: 2,
        CHANGE_NAME: 1 << 0,
        CHANGE_ACTIVE: 1 << 1,
        CHANGE_INVITED: 1 << 2,
        CHANGE_JOINED: 1 << 3,
        CHANGE_PLAYLIST: 1 << 4,
        CHANGE_NEWSFEED: 1 << 5,
    },

    constructor: function (config) {
        var that = this;
        this.callParent(arguments);
        this.set('log', [{action: {type: null}, party_state: {
            id: config.id,
            owner_id: config.owner_id,
            name: "",
            invited_user_ids: {},
            joined_user_ids: {},
            track_entries: [],
            active: this.self.ACTIVE_OFF
        }}]);
        console.log("pre", config);
        console.log("post", this.get('id'));
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

    getActions: function () {
        var that = this;
        SOP.domain.SopBaseDomain.getActions(this.get('id'), this.calculateLastActionId(), function (actions) {
            that.feed(actions);
        });
    },

    feed: function (actions) {
        var party_log = this.get('log'), lowest_changed = party_log.length + 1, i, new_items = {};
        Ext.Array.each(actions, function (action) {
            if (party_log[action.nr]) {
                return; //already fed
            }
            party_log[action.nr] = action;
            new_items[action.nr] = true;
            lowest_changed = Math.min(lowest_changed, action.nr);
        });
        this.set('log', party_log);
        for (i = lowest_changed; i < party_log.length; i++) {
            this.recalculateParty(i, !!new_items[i]);
        }
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
            party_state.owner_id = action.user_id;
            changed |= this.self.CHANGED_NAME | this.self.CHANGED_ACTIVE;
            break;
        case "PartyChangeNameAction":
            party_state.name = action.name;
            changed |= this.self.CHANGED_NAME;
            break;
        case "PartyInviteAction":
            party_state.invited_user_ids[action.invited_user_id] = action.created;
            changed |= this.self.CHANGED_INVITED;
            break;
        case "PartyKickAction":
            delete party_state.invited_user_ids[action.kicked_user_id];
            changed |= this.self.CHANGED_INVITED;
            if (party_state.joined_user_ids[action.kicked_user_id]) {
                delete party_state.joined_user_ids[action.kicked_user_id];
                changed |= this.self.CHANGED_JOINED;
            }
            break;
        case "PartyJoinedAction":
            party_state.joined_user_ids[action.user_id] = action.created;
            changed |= this.self.CHANGED_INVITED;
            break;
        case "PartyLeftAction":
            delete party_state.joined_user_ids[action.user_id];
            changed |= this.self.CHANGED_JOINED;
            break;
        case "PartySongAddAction":
            party_state.track_entries.push({song: Ext.create("SOP.model.Track", {id: action.song_id}),
                                           user_id: action.user_id,
                                           deleted_by_user_id: null});
            changed |= this.self.CHANGED_PLAYLIST;
/*            if (is_new) {
                doCommandCallback(Party.COMMAND_PLAY_IF_STOPPED, {position: party.song_ids.length - 1});
            }*/
            break;
        case "PartySongRemoveAction":
            party_state.song_entries[action.position].deleted_by_user_id = action.user_id;
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
