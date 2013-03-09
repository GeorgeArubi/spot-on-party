/*jshint */
/*global exports, require*/

var root = this;
var _ = root._;
var Backbone = root.Backbone;
var clutils = root.clutils;
var PM = root.PM;

if (typeof exports !== "undefined") {
    /* node */
    if (!_) {_ = require("./underscore"); }
    if (!Backbone) {Backbone = require("./backbone"); }
    if (!clutils) {clutils = require("./clutils"); }
    PM = exports;
    PM.config = require("./config");
} else {
    if (!_) {throw "Underscore not loaded"; }
    if (!Backbone) {throw "Backbone not loaded"; }
    if (!clutils) {throw "clutils not loaded"; }
    if (!PM) {
        PM = {};
    }
}


(function (PM) {
    "use strict";
    if (!PM.models) {
        PM.models = {};
    }
    if (!PM.collections) {
        PM.collections = {};
    }

    var enableChildTracking = function (Klass) {
        var old_extend = Klass.extend;
        Klass.__children = [];
        Klass.extend = function () {
            var That = this;
            var result = old_extend.apply(That, arguments);
            That.__children.push(result);
            result.__children = [];
            return result;
        };
    };

    enableChildTracking(Backbone.Model);

    PM.models.BaseModel = Backbone.Model.extend({
        idAttribute: "_id",
        _fields: {_id: 1},
        _validate_on_creation: true,

        constructor: function () {
            var that = this;
            if (!that.constructor.type) {
                throw "Object without type";
            }
            that.heritage = [that.constructor];
            while ("__super__" in _.last(that.heritage)) {
                that.heritage.push(_.last(that.heritage).__super__.constructor);
            }

            that._all_fields = _.extend.apply(that, _.map(that.heritage, function (Klass) {return Klass.prototype._fields || {}; }).reverse());

            Backbone.Model.apply(that, arguments);
            if (that._validate_on_creation) {
                if (that.validate) {
                    var validation_error = that.validate(that.attributes);
                    if (validation_error) {
                        throw validation_error;
                    }
                }
            }
        },

        serializeAllButId: function () {
            var that = this;
            var fields = _.keys(that._all_fields);
            delete fields._id;
            return _.pick(that.attributes, fields);
        },

        get: function (attribute) {
            var that = this;
            if (!(attribute in that._all_fields)) {
                throw "Object \"" + that.constructor.type + "\" doesn't have field \"" + attribute + "\"";
            }
            return Backbone.Model.prototype.get.apply(that, arguments);
        },

        set: function (attribute) {
            var that = this;
            if (!_.isNull(attribute)) {
                var keys = (_.isObject(attribute) ? _.keys(attribute) : [attribute]);
                _.each(keys, function (key) {
                    if (!(key in that._all_fields)) {
                        throw "Object \"" + that.constructor.type + "\" doesn't have field \"" + key + "\"";
                    }
                });
            }
            return Backbone.Model.prototype.set.apply(that, arguments);
        }
    });

    PM.models.BaseModelLazyLoad = PM.models.BaseModel.extend({
        _fields: {
            _status: 1,
        },

        constructor: function () {
            var that = this;
            PM.models.BaseModel.apply(that, arguments);
            if (!that.get("_status")) {
                that.set("_status", that.constructor.NOT_LOADED);
            }
            if (that.get("_status") === that.constructor.NOT_LOADED) {
                _.delay(_.bind(that.lazyLoad, that), 0); // first allow the initialize to run
            }
        },

        /*
         * calls exactly once: when the item is loaded. Afterwards (or if it will never reach the loaded state), the reference to the callback is destroyed
         */
        onLoaded: function (callback) {
            var that = this;
            var toExecute = function () {
                switch (that.get("_status")) {
                case that.constructor.LOADED:
                    callback(that);
                    that.off("change:_status", toExecute);
                    break;
                case that.constructor.ERROR:
                    that.off("change:_status", toExecute);
                    break;
                }
            };
            that.on("change:_status", toExecute);
            toExecute();
        },

        lazyLoad: function () {
            var that = this;
            console.error("Should lazy-load: " + that.id);
        },

        isLoaded: function () {
            var that = this;
            var That = this.constructor;
            return that.get("_status") === That.LOADED;
        },

        /**
         * Gets html for a field. If object has not loaded yet, gets some placeholder, which will be filled in as soon as the field is available
         * It's a very good question whether this should be part of the model (probably not), but since it's just one function, I forgive myself
         *
         * NOTE: HTML has to be added to document directly, or the replace will not work
         */
        getHtmlLazyLoad: function (fieldname) {
            var that = this;
            var That = this.constructor;
            That.id_counter = That.id_counter || 0;
            if (that.isLoaded()) {
                return clutils.encodeHTML(that.get(fieldname));
            }
            var id = "ll_" + That.type + "_" + (That.id_counter++);
            that.onLoaded(function () {
                var el = root.document.getElementById(id);
                if (el) {
                    el.outerHTML = that.getHtmlLazyLoad(fieldname);
                }
            });
            return '<span class="lazyload" id="' + id + '">' + clutils.encodeHTML(that.get(fieldname) || "") + '</span>';
            
        }
    }, {
    /* static members */
        NOT_LOADED: "not loaded",
        LOADED: "loaded",
        LOADING: "loading",
        ERROR: "error",

        _cache: {},

        getById: function (id) {
            var That = this;
            if (!That.getFromCache(id)) {
                That.setToCache(new That({_id: id}));
            }
            return That.getFromCache(id);
        },

        getFromCache: function (id) {
            var That = this;
            if (!That._cache[That.type]) {
                return undefined;
            }
            return That._cache[That.type][id];
        },

        setToCache: function (object) {
            var That = this;
            if (!object instanceof That) {
                console.warn(object, That);
                throw "Object not of right class";
            }
            if (!object.id) {
                throw "Object doesn't have a valid id: " + object.id;
            }
            if (!That._cache[That.type]) {
                That._cache[That.type] = {};
            }
            var cached_object = That.getFromCache(object.id);
            if (cached_object) {
                //update the cached object instead of inserting a new one
                cached_object.set(object.attributes);
            } else {
                That._cache[That.type][object.id] = object;
            }
        },

    });

    PM.models.User = PM.models.BaseModelLazyLoad.extend({
        _fields: {
            name: 1,
            cover_url: 1,
            cover_offset_y: 1,
        },

        defaults: {
            name: "",
            cover_url: false,
            cover_offset_y: 0,
        },

        getProfilePictureUrl: function () {
            var that = this;
            return PM.domain.FacebookDomain.getProfilePictureUrl(that.id);
        },

        getName: function (party) {
            var that = this;
            var That = that.constructor;
            if (that.id === That.MASTER_ID) {
                return party.getOwner().get("name") + "*";
            } else {
                return that.get("name");
            }
        },

        lazyLoad: function () {
            var that = this;
            that.set("_status", that.constructor.LOADING);
            that.constructor.queueToLazyLoad.push(that.id);
            that.constructor.lazyLoadQueuedIds();
            _.delay(function () {
                if (that.get("_status") !== that.constructor.LOADED) {
                    that.set("_status", that.constructor.ERROR);
                }
            }, 30000);
        },

    }, {
        type: "User",
        MASTER_ID: "master",
        queueToLazyLoad: [],

        lazyLoadQueuedIds: _.debounce(function () {
            var That = this;
            console.log("started");
            PM.domain.FacebookDomain.lookupUsers(That.queueToLazyLoad, function (users_data) {
                _.each(users_data, function (user_data) {That.getByFacebookData(user_data); });
            });
        }, 50),

        getByFacebookData: function (facebookdata) {
            var That = this;
            clutils.checkConstraints(facebookdata, {id: {_isNumeric: true}, name: {_isString: true}, cover: {
                source: {_isString: true},
                offset_y: {_isNumber: true},
                id: {_isNumeric: true},
                _optional: true,
            }});
            var newdata = {
                _status: That.LOADED,
                _id: parseInt(facebookdata.id, 10),
                name: facebookdata.name,
                cover_url: facebookdata.cover && facebookdata.cover.source,
                cover_offset_y: facebookdata.cover && facebookdata.cover.offset_y,
            };
            var user = new That(newdata);
            That.setToCache(user);
            return user;
        },

        getAllFriendsOfLoggedinUser: function (callback) {
            var That = this;
            PM.domain.FacebookDomain.getAllFriends(function (friends_data) {
                callback(_.map(_.sortBy(friends_data, "name"), function (friend_data) {
                    return That.getByFacebookData(friend_data);
                }));
            });
        }
    });

    PM.models.User.setToCache(new PM.models.User({
        _id: PM.models.User.MASTER_ID,
        name: PM.config.master_name,
        _status: PM.models.User.LOADED,
    }));

    PM.models.UserInParty = PM.models.BaseModel.extend({
        _fields: {
            user_id: 1,
            joined: 1,
            created: 1,
            deleted: 1,
            ts_last_action: 1,
        },
        
        defaults: function () {
            return {
                joined: 0, //joined is a count of how many open connections someone has
                deleted: null,
            };
        },

        serialize: function () {
            var that = this;
            return that.serializeAllButId();
        },

        validate: function (attrs) {
            if (!_.isNumber(attrs.user_id)) {
                return "Need to provide a user_id";
            }
            if (!(clutils.isTimestamp(attrs.created))) {
                return "Created needs to be a date " + JSON.stringify(attrs.created);
            }
            if (!(clutils.isTimestamp(attrs.ts_last_action))) {
                return "Active needs to be a date";
            }
            if (! _.isNumber(attrs.joined)) {
                return "Joined needs to be a number";
            }
            if (attrs.joined > PM.config.MAX_CONCURRENT_JOINS_PER_USER) {
                return "We only allow " + PM.config.MAX_CONCURRENT_JOINS_PER_USER + " concurrent connections per user par party";
            }
        },
        
        didAction: function (when) {
            var that = this;
            that.set("ts_last_action", when);
        },

        getUser: function () {
            var that = this;
            return PM.models.User.getById(that.get("user_id"));
        },

        isJoined: function () {
            var that = this;
            return !!that.get("joined");
        },

        join: function (when) {
            var that = this;
            that.set({joined: that.get("joined") + 1, ts_last_action: when});
        },

        unjoin: function () {
            var that = this;
            that.set({joined: that.get("joined") - 1});
        },

        unjoinAll: function () {
            var that = this;
            that.set("joined", 0);
        },
    }, {
        type: "UserInParty",

        unserialize: function (data) {
            var That = this;
            return new That(_.omit(data, '_id'));
        },
    });


    PM.models.Track = PM.models.BaseModelLazyLoad.extend({
        _fields: {
            name: 1,
            artist: 1,
            album: 1,
            albumcover: 1,
            duration: 1,
        },

        lazyLoad: function () {
            var that = this;
            that.set("_status", that.constructor.LOADING);
            PM.domain.SpotifyDomain.lookup(that.id, function (track_data) {
                that.constructor.getBySpotifyData(track_data);
            });
            _.delay(function () {
                if (that.get("_status") !== that.constructor.LOADED) {
                    that.set("_status", that.constructor.ERROR);
                }
            }, 30000);
        },

    }, {
        type: "Track",

        getBySpotifyData: function (track_data) {
            var That = this;
            var track = new That(_.extend({_status: That.LOADED, artist: track_data.artists.join(", ")}, _.omit(track_data, "artists")));
            That.setToCache(track);
            return track;
        },

        getByFacebookData: function (track_data) {
            var That = this;
            var id = "spotify:track:" + track_data.data.song.url.substr(-22);
            var track = That.getById(id);
            track.set("name", track_data.data.song.title);
            return track;
        },
    });

    PM.models.TrackInPlaylist = PM.models.BaseModel.extend({
        _fields: {
            track_id: 1,
            user_id: 1,
            created: 1,
            tip_number: 1, /*some int that unqiuely identifies this item in this playlist. For now just using action number */
        },

        defaults: function () {
            return {
            };
        },

        serialize: function () {
            var that = this;
            return that.serializeAllButId();
        },

        getTrack: function () {
            var that = this;
            return PM.models.Track.getById(that.get("track_id"));
        },

        getUser: function () {
            var that = this;
            return PM.models.User.getById(that.get("user_id"));
        },

        canBeDeletedBy: function (user_id, party) {
            var that = this;
            if (that.get("user_id") === user_id) {
                return true;
            }
            if (party.isOwner(user_id)) {
                return true;
            }
            return false;
        },

        validate: function (attrs) {
            if (!_.isString(attrs.track_id)) {
                return "Need to provide a track_id";
            }
            if (!_.isNumber(attrs.user_id) && attrs.user_id !== PM.models.User.MASTER_ID) {
                return "Need to provide a user_id";
            }
            if (!(clutils.isTimestamp(attrs.created))) {
                return "Created needs to be a date";
            }
            if (!_.isNumber(attrs.tip_number)) {
                return "Tip_number should be a number";
            }
        }
    }, {
        type: "TrackInPlaylist",

        unserialize: function (data) {
            var That = this;
            return new That(_.omit(data, '_id'));
        },
    });

    PM.models.Action = PM.models.BaseModel.extend({ //note: validation happens on validateAndApply
        _validate_on_creation: false,
        _fields: {
            created: 1,
            user_id: 1,
            party_id: 1,
            number: 1,
        },

        defaults: function () {
            return {
                created: clutils.nowts(),
            };
        },

        getUser: function () {
            var that = this;
            return PM.models.User.getById(that.get("user_id"));
        },

        initialize: function (attributes, options) {
            var that = this;
            that.set({
                user_id: options.user_id, // no default, just overwrite it
            }, {silent: true});
            that.party = options.party;
            if (that.get("party_id") !== that.party.id) {
                throw "action is not for the provided party";
            }
        },

        prepareValidate: function (callback) {
            _.delay(callback, 0);
        },

        validateAndApplyAction: function (callback_success, callback_fail) {
            callback_success = callback_success || function (action) {console.log("new action: " + action.get("number") + " -- " + action.constructor.type); };
            callback_fail = callback_fail || function (reason) {throw "creating new action failed: " + reason; };
            var that = this;
            that.prepareValidate(function () {
                if (that.validate) {
                    var validate_error = that.validate(that.attributes);
                    if (validate_error) {
                        console.warn("Action failed: " + validate_error);
                        callback_fail(validate_error);
                        return;
                    }
                }
                that.applyValidatedAction();
                callback_success(that);
            });
        },

        applyValidatedAction: function () {
            var that = this;
            if (that.get("number") && that.get("number") !== that.party.get("log").length + 1) {
                throw "action has number " + that.get("number") + " but party expects number " + (that.party.get("log").length + 1);
            } else {
                that.set("number", that.party.get("log").length + 1, {silent: true}); //be silent, we don't want to trigger validation; either we already did that, or we explicitly don't want it
                that.on("change", function () {throw "trying to change an action, which is not allowed"; });
                that.applyActionToParty();
                that.party.get("log").add(that);
            }
        },

        validate: function (attrs) {
            var that = this;
            if (!attrs.user_id) {
                return "Supply a user (owner) for this action"; // NOTE: make sure that the user_id for this action was overwritten by trusted code
            }
            if (!that.party) {
                return "Party could not be loaded";
            }
            if (!that.party.isOwner(attrs.user_id) && !that.party.isMember(attrs.user_id)) {
                return "The user is not a member of the party";
            }
        },

        serialize: function () {
            var that = this;
            return _.extend({_TYPE: that.constructor.type}, that.serializeAllButId());
        }
    }, {
        unserializeFromTrusted: function (data, party) {
            var That = this;
            var ActionClass = _.find(That.__children, function (Action) {return Action.type === data._TYPE; });
            if (!ActionClass) {
                throw "No action class found for " + data._TYPE;
            }
            var mydata = _.clone(data);
            delete mydata._TYPE;
            return new ActionClass(mydata, {user_id: mydata.user_id, party: party});
        },

        createAction: function (user_or_user_id, party, type, properties) {
            var That = this;
            var ActionClass = _.find(That.__children, function (Action) {return Action.type === type; });
            if (!ActionClass) {
                throw "No action class found for " + type;
            }
            var user_id = _.isObject(user_or_user_id) ? user_or_user_id.id : user_or_user_id;
            return new ActionClass(_.extend({party_id: party.id}, properties || {}), {user_id: user_id, party: party});
        },

        createAndApplyAction: function (user_or_user_id, party, type, properties, success_callback, failure_callback) {
            var That = this;
            var action = That.createAction(user_or_user_id, party, type, properties);
            action.validateAndApplyAction(success_callback, failure_callback);
        }
    });

    PM.models.InitializeAction = PM.models.Action.extend({
        _fields: {
            owner_id: 1,
        },

        validate: function (attrs) {
            var that = this;
            if (that.party.get("log").length > 0) {
                return "Can only initialize new party";
            }
            return that.constructor.__super__.validate.call(that, attrs);
        },

        applyActionToParty: function () {
            var that = this;
            that.party.set({
                owner_id: that.get("owner_id"),
                created: that.get("created"),
                last_updated: that.get("created"),
            });
        },
    }, {
        type: "Initialize",
    });


    PM.models.ChangeNameAction = PM.models.Action.extend({
        _fields: {
            name: 1,
        },

        validate: function (attrs) {
            var that = this;
            if (!that.party.isOwner(attrs.user_id)) {
                return "Only owner can do this";
            }
            if (!_.isString(attrs.name)) {
                return "You must supply a name";
            }
            return that.constructor.__super__.validate.call(that, attrs);
        },

        applyActionToParty: function () {
            var that = this;
            that.party.set("name", that.get("name"));
        },
    }, {
        type: "ChangeName",
    });

    PM.models.InviteAction = PM.models.Action.extend({
        _fields: {
            invited_user_id: 1,
        },

        validate: function (attrs) {
            var that = this;
            if (!that.party.isOwner(attrs.user_id)) {
                return "Only owner can do this";
            }
            if (!attrs.invited_user_id) {
                return "invited_user_id must be present";
            }
            var user = PM.models.User.getById(that.get("invited_user_id"));
            if (user.get("_status") !== "loaded") {
                return "invited user could not be loaded";
            }
            if (that.party.isMember(attrs.invited_user_id)) {
                return "user already invited";
            }
            return that.constructor.__super__.validate.call(that, attrs);
        },

        prepareValidate: function (callback) {
            var that = this;
            var user = PM.models.User.getById(that.get("invited_user_id"));
            switch (user.get("_status")) {
            case "error":
            case "loaded":
                that.constructor.__super__.prepareValidate.call(that, callback);
                break;
            default:
                var handler;
                handler = function () {
                    user.off("change:_status", handler, this);
                    that.prepareValidate(callback);
                };
                user.on("change:_status", handler, this);
            }
        },

        applyActionToParty: function () {
            var that = this;
            that.party.get("users").add(new PM.models.UserInParty({
                user_id: that.get("invited_user_id"),
                created: that.get("created"),
                ts_last_action: that.get("created"),
            }));
            that.party.set("last_updated", that.get("created"));
        },
    }, {
        type: "Invite",
    });

    PM.models.KickAction = PM.models.Action.extend({
        _fields: {
            kicked_user_id: 1,
        },

        validate: function (attrs) {
            var that = this;
            if (!that.party.isOwner(attrs.user_id)) {
                return "Only owner can do this";
            }
            if (that.party.isOwner(attrs.kicked_user_id)) {
                return "The owner of the party can't be kicked";
            }
            if (!attrs.kicked_user_id) {
                return "kicked_user_id must be present";
            }
            if (!that.party.isMember(attrs.kicked_user_id)) {
                return "user not invited";
            }
            return that.constructor.__super__.validate.call(that, attrs);
        },

        applyActionToParty: function () {
            var that = this;
            var kicked_user_id = that.get("kicked_user_id");
            var record = that.party.getMemberRecord(kicked_user_id); //NOTE: validation guarantees that there is a record here
            that.party.get("users").remove(record);
            that.party.set("last_updated", that.get("created"));
        },
    }, {
        type: "Kick",
    });

    PM.models.JoinAction = PM.models.Action.extend({
        validate: function (attrs) {
            var that = this;
            var record = that.party.getMemberRecord(that.get("user_id")); //NOTE: validation guarantees that there is a record here
            if (record.get("joined") >= PM.config.MAX_CONCURRENT_JOINS_PER_USER) {
                return "User already joined to the max";
            }
            return that.constructor.__super__.validate.call(that, attrs);
        },

        applyActionToParty: function () {
            var that = this;
            var record = that.party.getMemberRecord(that.get("user_id")); //NOTE: validation guarantees that there is a record here
            record.join(that.get("created"));
        },
    }, {
        type: "Join",
    });

    PM.models.LeaveAction = PM.models.Action.extend({
        validate: function (attrs) {
            var that = this;
            if (!that.party.isJoined(attrs.user_id)) {
                return "User is not joined";
            }
            return that.constructor.__super__.validate.call(that, attrs);
        },

        applyActionToParty: function () {
            var that = this;
            var record = that.party.getMemberRecord(that.get("user_id")); //NOTE: validation guarantees that there is a record here
            record.unjoin();
        },
    }, {
        type: "Leave",
    });

    PM.models.TrackAddAction = PM.models.Action.extend({
        _fields: {
            track_id: 1,
        },

        validate: function (attrs) {
            var that = this;
            if (!attrs.track_id) {
                return "track_id must be present";
            }
            var track = PM.models.Track.getById(that.get("track_id"));
            if (track.get("_status") !== "loaded") {
                return "track could not be loaded";
            }
            if (!that.party.isMember(attrs.user_id)) {
                return "can only add song to a party you're member of";
            }
            //TODO: also check whether track is playable etc...
            return that.constructor.__super__.validate.call(that, attrs);
        },

        prepareValidate: function (callback) {
            var that = this;
            var track = PM.models.Track.getById(that.get("track_id"));
            switch (track.get("_status")) {
            case "error":
            case "loaded":
                that.constructor.__super__.prepareValidate.call(that, callback);
                break;
            default:
                var handler;
                handler = function () {
                    track.off("change:_status", handler, this);
                    that.prepareValidate(callback);
                };
                track.on("change:_status", handler, this);
            }
        },

        applyActionToParty: function () {
            var that = this;
            var playlist = that.party.get("playlist");
            playlist.add(new PM.models.TrackInPlaylist({
                user_id: that.get("user_id"),
                track_id: that.get("track_id"),
                created: that.get("created"),
                tip_number: that.get("number"),
            }));

            that.party.getMemberRecord(that.get("user_id")).didAction(that.get("created"));
            that.party.set("last_updated", that.get("created"));
            if (that.party.get("play_status") === "stop") {
                that.party.trigger("playcommand", "play", that.party.get("playlist").last().get("tip_number"));
            }
        },
    }, {
        type: "TrackAdd",
    });

    PM.models.TrackRemoveAction = PM.models.Action.extend({
        _fields: {
            tip_number: 1, //track_in_playlist_number
        },

        validate: function (attrs) {
            var that = this;
            if (!_.isNumber(attrs.tip_number)) {
                return "action must contain a tip_number";
            }
            var track_in_playlist = that.party.findTrackInPlaylistByTipNumber(attrs.tip_number);
            if (!_.isObject(track_in_playlist)) {
                return "no track in the playlist with that tip_number";
            }
            if (!track_in_playlist.canBeDeletedBy(attrs.user_id, that.party)) {
                return "songs can only be deleted by the one who added them (or the party owner)";
            }
            return that.constructor.__super__.validate.call(that, attrs);
        },

        applyActionToParty: function () {
            var that = this;
            var playlist = that.party.get("playlist");
            var track_in_playlist = that.party.findTrackInPlaylistByTipNumber(that.get("tip_number"));
            that.position = playlist.indexOf(track_in_playlist);
            that.track_id = track_in_playlist.get("track_id"); //don't assign the track object, since we don't want lazy-loading in the server
            playlist.remove(track_in_playlist);
            that.party.set("last_updated", that.get("created"));
            if (that.party.get("current_tip_number") === that.get("tip_number")) {
                that.party.trigger("playcommand", "play_next");
            }
        },
    }, {
        type: "TrackRemove",
    });

    PM.models.StartAction = PM.models.Action.extend({
        validate: function (attrs) {
            var that = this;
            if (that.party.get("active")) {
                return "trying to start an already active party";
            }
            return that.constructor.__super__.validate.call(that, attrs);
        },

        applyActionToParty: function () {
            var that = this;
            that.party.set({
                "active": true,
                "last_updated": that.get("created"),
            });
        },
    }, {
        type: "Start",
    });

    PM.models.EndAction = PM.models.Action.extend({
        validate: function (attrs) {
            var that = this;
            if (!that.party.get("active")) {
                return "trying to end an inactive party";
            }
            return that.constructor.__super__.validate.call(that, attrs);
        },

        applyActionToParty: function () {
            var that = this;
            that.party.set({
                "active": false,
            });
            that.party.get("users").each(function (user_in_party) {
                if (user_in_party.isJoined()) {
                    user_in_party.unjoinAll();
                }
            });
        },
    }, {
        type: "End",
    });

    PM.models.PauseAction = PM.models.Action.extend({
        validate: function (attrs) {
            var that = this;
            if (that.party.get("play_status") !== "play") {
                return "can't pause when not playing";
            }
            return that.constructor.__super__.validate.call(that, attrs);
        },

        applyActionToParty: function () {
            var that = this;
            that.party.trigger("playcommand", "pause");
        },
    }, {
        type: "Pause",
    });

    PM.models.PlayAction = PM.models.Action.extend({
        validate: function (attrs) {
            var that = this;
            if (that.party.get("play_status") === "play") {
                return "already playing";
            }
            return that.constructor.__super__.validate.call(that, attrs);
        },

        applyActionToParty: function () {
            var that = this;
            that.party.trigger("playcommand", "play");
        },
    }, {
        type: "Play",
    });

    PM.models.PlayTrackAction = PM.models.Action.extend({
        _fields: {
            tip_number: 1
        },

        validate: function (attrs) {
            var that = this;
            var track_in_playlist = that.party.findTrackInPlaylistByTipNumber(attrs.tip_number);
            if (!track_in_playlist) {
                return "Position to play doesn't exist";
            }
            return that.constructor.__super__.validate.call(that, attrs);
        },

        applyActionToParty: function () {
            var that = this;
            that.party.trigger("playcommand", "play", that.get("tip_number"));
        },
    }, {
        type: "PlayTrack",
    });

    /* perhaps not really an action, but just nicer if it pretends to be one :) */
    PM.models.PlayStatusFeedbackAction = PM.models.Action.extend({
        _fields: {
            play_status: 1, // one of: play, pause or stop
            current_tip_number: 1, // the currently playing track_in_playlist
            current_place_in_track: 1, // see comment in Party
            created: 1,
        },

        defaults: function () {
            return {
                created: clutils.nowts(),
            };
        },

        validate: function (attrs) {
            var that = this;
            if (attrs.play_status !== "play" && attrs.play_status !== "stop" && attrs.play_status !== "pause") {
                return "No valid play status: \"" + attrs.play_status + "\"";
            }
            if (attrs.play_status === "pause" && !_.isNumber(attrs.current_place_in_track)) {
                return "Expected a number for current_place_in_track";
            }
            if (attrs.play_status === "play" && !clutils.isTimestamp(attrs.current_place_in_track)) {
                return "Expected a date for current_place_in_track";
            }
            if (attrs.play_status === "stop") {
                if (attrs.current_tip_number !== -1) {
                    return "With a stop command, only tip_number -1 is allowed";
                }
            } else if (!that.party.findTrackInPlaylistByTipNumber(attrs.current_tip_number)) {
                return "Trying to play a track that doesn't exist " + attrs.current_tip_number;
            }
        },

        applyActionToParty: function () {
            var that = this;
            that.party.set({
                play_status: that.get("play_status"),
                current_tip_number: that.get("current_tip_number"),
                current_place_in_track: that.get("current_place_in_track"),
            });
        },
    }, {
        type: "PlayStatusFeedback",
    });

    PM.models.DummyAction = PM.models.Action.extend({
        initialize: function () {},
    }, {
        type: "Dummy",
    });

    PM.collections.Playlist = Backbone.Collection.extend({model: PM.models.TrackInPlaylist});
    PM.collections.UsersInParty = Backbone.Collection.extend({model: PM.models.UserInParty});
    PM.collections.PartyLog = Backbone.Collection.extend({model: PM.models.Action});


    PM.models.Party = PM.models.BaseModel.extend({
        _fields: {
            playlist: 1,
            users: 1,
            log: 1,
            name: 1,
            active: 1,
            owner_id: 1,
            play_status: 1,
            current_tip_number: 1,
            current_place_in_track: 1,
            created: 1,
            last_updated: 1,
        },

        defaults: function () {
            return {
                playlist: new PM.collections.Playlist(),
                users: new PM.collections.UsersInParty(),
                log: new PM.collections.PartyLog(),
                name: "",
                active: false,
                owner_id: 0,
                play_status: "stop", //or "play" or "pause",
                current_tip_number: -1,
                current_place_in_track: null, //when paused, contains ms after track start, when playing contains date when this song would have started had it been played in whole
                created: null,
                last_updated: null,
            };
        },

        serialize: function () {
            var that = this;
            return {
                _id: that.id,
                name: that.get("name"),
                active: that.get("active"),
                owner_id: that.get("owner_id"),
                play_status: that.get("play_status"),
                current_tip_number: that.get("current_tip_number"),
                current_place_in_track: that.get("current_place_in_track"),
                created: that.get("created"),
                last_updated: that.get("last_updated"),
                playlist: that.get("playlist").map(function (track_in_playlist) {return track_in_playlist.serialize(); }),
                users: that.get("users").map(function (user_in_party) {return user_in_party.serialize(); }),
                log: that.get("log").length,
            };
        },

        /* returns the object that we want to index in mongo */
        indexableObject: function () {
            var that = this;
            return {
                _id: that.id,
                name: that.get("name"),
                owner_id: that.get("owner_id"),
                created: that.get("created"),
                last_updated: that.get("last_updated"),
                track_ids: that.get("playlist").chain()
                    .map(function (track_in_playlist) { return track_in_playlist.get("track_id"); })
                    .value(),
                user_ids: that.get("users").chain()
                    .map(function (user_in_party) {return user_in_party.get("user_id"); })
                    .value(),
            };
        },

        initialize: function () {
            var that = this;
            var That = that.constructor;
            if (That.partyCache[that.id]) {
                throw "Aready party with this ID in partyCache";
            }
            That.partyCache[that.id] = that;
        },

        getOwner: function () {
            var that = this;
            return PM.models.User.getById(that.get("owner_id"));
        },

        getMemberRecord: function (user_or_user_id) {
            var that = this;
            var user_id_to_check = (_.isObject(user_or_user_id) ? user_or_user_id.id : user_or_user_id);
            if (user_id_to_check === PM.models.User.MASTER_ID) {
                return that.getMemberRecord(that.get("owner_id"));
            }
            return that.get("users").find(function (user_in_party) {
                return user_in_party.get("user_id") === user_id_to_check;
            });
        },

        isMember: function (user_or_user_id) {
            var that = this;
            return !!that.getMemberRecord(user_or_user_id);
        },

        getMembersInPartyOrderedByActive: function () {
            var that = this;
            return that.get("users")
                .chain()
                .sortBy(function (user_in_party) {return user_in_party.get("ts_last_action"); })
                .reverse()
                .value();
        },

        getCurrentPlaylistIndex: function () {
            var that = this;
            var track_in_playlist = that.getCurrentTrackInPlaylist();
            if (!track_in_playlist) {
                return -1;
            }
            return that.get("playlist").indexOf(track_in_playlist);
        },

        findTrackInPlaylistByTipNumber: function (tip_number) {
            var that = this;
            return that.get("playlist").find(function (track_in_playlist) {
                return track_in_playlist.get("tip_number") === tip_number;
            });
        },

        getCurrentTrackInPlaylist: function () {
            var that = this;
            return that.findTrackInPlaylistByTipNumber(that.get("current_tip_number"));
        },

        getCurrentTrack: function () {
            var that = this;
            var track_in_playlist = that.getCurrentTrackInPlaylist();
            if (!track_in_playlist) {
                return null;
            }
            return track_in_playlist.getTrack();
        },

        isJoined: function (user_or_user_id) {
            var that = this;
            var user_in_party = that.getMemberRecord(user_or_user_id);
            return user_in_party && user_in_party.isJoined();
        },

        isOwner: function (user_or_user_id) {
            var that = this;
            var user_id_to_check = (_.isObject(user_or_user_id) ? user_or_user_id.id : user_or_user_id);
            return PM.models.User.MASTER_ID === user_id_to_check || that.get("owner_id") === user_id_to_check;
        },

        shouldShowInviteFriendsOnOpen: function () {
            var that = this;
            return that.get("users").length === 1 && that.get("playlist").length === 0;
        },

        /**
          * An action executed by the party owner, the master
          **/
        createAndApplyMasterAction: function (type, properties, success_callback, failure_callback) {
            var that = this;
            PM.models.Action.createAndApplyAction(PM.models.User.MASTER_ID, that, type, properties, success_callback, failure_callback);
        },

        applyPlayStatusFeedback: function (play_status, current_tip_number, current_place_in_track) {
            var that = this;
            var data = {
                play_status: play_status,
                current_tip_number: current_tip_number,
                current_place_in_track: current_place_in_track,
            };
            PM.models.Action.createAndApplyAction(PM.models.User.MASTER_ID, that, "PlayStatusFeedback", data);
        },

        validate: function (attrs) {
            var that = this;
            if (attrs._id !== that.id) {
                throw "Changing ID is not allowed";
            }
            if (attrs.play_status !== "play" && attrs.play_status !== "stop" && attrs.play_status !== "pause") {
                return "No valid play status: \"" + attrs.play_status + "\"";
            }
        },

        mayGivePlayCommand: function (user_or_user_id) {
            var that = this;
            return that.isOwner(user_or_user_id);
        },

    }, {
        type: "Party",
        
        getDefaultPartyName: function (owner) {
            return owner.get("name").toLowerCase() + "'s party";
        },

        /**
         * if party is provided, the party is copied into that one. Else a new party is created
         **/
        
        unserialize: function (data) {
            var That = this;
            var party_id = data._id;
            var party = That.partyCache[party_id];
            if (!party) {
                party = new That({_id: party_id});
            }

            party.set({
                name: data.name,
                active: data.active,
                owner_id: data.owner_id,
                play_status: data.play_status,
                current_tip_number: data.current_tip_number,
                current_place_in_track: data.current_place_in_track,
                created: data.created,
                last_updated: data.last_updated,
            });
            party.get("playlist").reset(_.map(data.playlist, function (track_in_playlist_data) {return PM.models.TrackInPlaylist.unserialize(track_in_playlist_data); }));
            party.get("users").reset(_.map(data.users, function (user_in_party_data) {return PM.models.UserInParty.unserialize(user_in_party_data); }));
            party.get("log").reset(_.map(_.range(data.log), function (undefined) {return new PM.models.DummyAction(); }));
            return party;
        },
    });
    PM.models.Party.partyCache = {};

    PM.collections.Parties = Backbone.Collection.extend({model: PM.models.Party});

    PM.util = PM.util || {};

    PM.collections.Users = Backbone.Collection.extend({
        model: PM.models.User,
    });

}(PM));


