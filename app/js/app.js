/*jshint browser: true*/
/*global clutils, _, $, Backbone, Toolbox */

window.PM = window.PM || {};
window.PM.app = window.PM.app || {};

(function (PM) {
    "use strict";
    var LoginView, PartyOverviewView, OldPartyView, PartyView, BaseAddSongView, AddSongSearchView, AddSongRecentView, AddSongPlaylistView;

    var getTemplate = function (id) {
        var template = PM.templates[id];
        if (!_.isFunction(template)) {
            throw "Template '" + id + "' not found";
        }
        return template;
    };

    var createAndRenderViewLoggedin = function () {
        var createAndRenderViewArguments = arguments;
        if (PM.app.loggedin_user) {
            createAndRenderView.apply(this, createAndRenderViewArguments);
        } else {
            PM.domain.FacebookDomain.isLoggedin(function (loggedin) {
                if (loggedin) {
                    PM.domain.FacebookDomain.getLoggedinUserId(function (user_id) {
                        PM.app.loggedin_user = PM.models.User.getById(user_id); // will lazy-load, which is fine I think
                        PM.domain.FacebookDomain.getAccessToken(function (accessToken) {
                            PM.domain.PartyNodeDomain.connect(accessToken, false, function () {
                                PM.domain.FacebookDomain.on("new token", function (token) {
                                    PM.domain.PartyNodeDomain.updateToken(token);
                                });
                                createAndRenderView.apply(this, createAndRenderViewArguments);
                            });
                        });
                    });
                } else {
                    $.mobile.changePage("#login");
                }
            });
        }
    };

    var activeParties = new PM.collections.Parties();
    PM.domain.PartyNodeDomain.on("connection", function () {
        activeParties.reset([]);
    });
    PM.domain.PartyNodeDomain.on("plus-active-party", function (party_data) {
        activeParties.add(PM.models.Party.unserialize(party_data));
    });
    PM.domain.PartyNodeDomain.on("minus-active-party", function (party_id) {
        activeParties.remove(activeParties.get(party_id));
    });
    PM.domain.PartyNodeDomain.on("new-active-party-action", function (action_data) {
        var party = activeParties.get(action_data.party_id);
        if (party) {
            var action = PM.models.Action.unserializeFromTrusted(action_data, party);
            action.applyValidatedAction();
        }
    });

    var createAndRenderView = function (Viewclass, element, options) {
        var myoptions = _.extend(options || {}, {el: element});
        var view = new Viewclass(myoptions);
        view.render();
        var el = $(element);
        el.addClass(view.className);
        el.prop("view", view);
        el.trigger("pagecreate");
    };

    var toggleShowActionSheet = function ($element) {
        if ($element.hasClass("open")) {
            $element.css('height', "");
            $element.removeClass("open");
        } else {
            var height = $element.children().innerHeight();
            $element.css('height', height + "px");
            $element.addClass("open");
        }
    };

    OldPartyView = Backbone.View.extend({
        template: getTemplate('old-party-page'),
        className: 'old-party-page',

        render: function () {
            var that = this;
            clutils.checkConstraints(that.options.party_id, {_isUniqueId: true});
            var doRender = function () {
                that.$el.html(that.template({party: that.party}));
                that.$el.trigger("pagecreate");
            };
            PM.domain.PartyNodeDomain.getMyParty(that.options.party_id, function (party_data) {
                if (!party_data) {
                    throw "Party with id " + that.options.party_id + " could not be found";
                }
                var party = PM.models.Party.unserialize(party_data);
                that.party = party;
                doRender();
            });
            return that;
        },
    });

    var ActivePartyUtil = Toolbox.Base.extend({
    }, {
        party_id: null,
        counter: 0,
        currentpopup: null,
        currentview: null,

        init: function () {
            var That = this;
            activeParties.on("add remove reset", function () {
                var current_party_active = !! activeParties.get(That.party_id);
                if (!That.party_id || current_party_active) {
                    if (That.currentpopup) {
                        That.currentpopup.popup("close");
                        //reregister as logged in
                        PM.domain.PartyNodeDomain.activateParty(That.party_id);
                    }
                } else {
                    if (!That.currentpopup) {
                        That.currentpopup = $(getTemplate("party-inactive-message")()).popup().popup("open");
                        That.currentpopup.one("popupafteropen", function () {
                            $('.ui-popup-screen.in').on("click", function (event) {event.stopImmediatePropagation(); }); // removes overlay click-to-close
                            $('.ui-popup-screen.in').on("touchstart", function (event) {event.stopImmediatePropagation(); }); // removes overlay click-to-close
                        });
                        That.currentpopup.one("popupafterclose", function () {
                            That.currentpopup = null;
                            console.log("detacked");
                        });
                        That.currentpopup.trigger("create");
                    }
                }
            });
        },

        deactivate: function () {
            var That = this;
            if (That.counter < 1) {
                throw "Trying to deactivate party, will result in negative party activations";
            }
            That.counter--;
            if (That.counter === 0) {
                PM.domain.PartyNodeDomain.activateParty(0);
                That.party_id = null;
            }
        },

        activate: function (party_id) {
            var That = this;
            if (That.party_id !== party_id) {
                //we started a new party. Any old party will be auto-removed
                That.party_id = party_id;
                That.counter = 0;
                PM.domain.PartyNodeDomain.activateParty(party_id);
            }
            That.counter++;
        },
    });

    ActivePartyUtil.init();

    BaseAddSongView = Backbone.View.extend({
        addSong: _.debounce(function (event) {
            var that = this;
            var $target = $(event.currentTarget);
            var track_id = $target.attr("track_id");
            $target.addClass("ui-btn-active");
            var action = PM.models.Action.createAction(PM.app.loggedin_user, that.party, "TrackAdd", {track_id: track_id});
            PM.domain.PartyNodeDomain.proposeAction(action.serialize(), function (result) {
                if (!result) {
                    throw "help";
                }
                $.mobile.changePage("#activeparty_" + that.party.id);
            });
        }, 1000, {immediate: true, }),
    });

    AddSongPlaylistView = BaseAddSongView.extend({
        template: getTemplate('add-song-playlist-page'),
        className: 'add-song-playlist-page add-song-page',

        events: {
            "click ul.search-results > li.playlist": "showPlaylist",
            "click ul.search-results > li.track": "addSong",
            "click #back-to-playlists": "loadPlaylists",
        },

        close: function () {
            var that = this;
            ActivePartyUtil.deactivate();
            that.$('ul.search-results > li').removeClass("ui-btn-active");
            that.undelegateEvents();
        },

        render: function () {
            var that = this;

            clutils.checkConstraints(that.options.party_id, {_isUniqueId: true});
            that.party = activeParties.get(that.options.party_id);
            if (!that.party) {
                console.log("no party found with id " + that.options.party_id);
                $.mobile.changePage("#partyoverview");
                return;
            }
            ActivePartyUtil.activate(that.party.id);

            that.$el.html(that.template({party: that.party}));
            that.loadPlaylists();
            return that;
        },

        loadPlaylists: function () {
            var that = this;
            $('ul.search-results').addClass("loading");
            that.$el.removeClass("tracks").removeClass("playlists");
            $('ul.search-results .track').remove();
            $('ul.search-results .playlist').remove();

            PM.domain.FacebookDomain.getSpotifyPlaylists(function (playlistdata) {
                var playlists = _.map(playlistdata, function (data) {return {id: data.data.playlist.id, name: data.data.playlist.title, _id: "spotify:playlist:" + data.data.playlist.url.substr(-22)}; });
                var html = getTemplate("searchresult-playlists")({playlists: playlists});
                that.$('ul.search-results').append(html).removeClass("loading");
                that.$el.addClass("playlists");
                that.$('ul.search-results.ui-listview').listview('refresh');
            });
        },

        showPlaylist: _.debounce(function (event) {
            var that = this;
            var $target = $(event.currentTarget);
            var facebook_playlist_id = $target.attr("playlist_id");
            that.loadPlaylist(facebook_playlist_id);
        }, 1000, {immediate: true, }),
 
        loadPlaylist: function (facebook_playlist_id) {
            var that = this;
            $('ul.search-results').addClass("loading");
            that.$el.removeClass("tracks").removeClass("playlists");
            $('ul.search-results .track').remove();
            $('ul.search-results .playlist').remove();

            PM.domain.FacebookDomain.getPlaylistTracks(facebook_playlist_id, function (trackdata) {
                var tracks = _.map(trackdata, _.bind(PM.models.Track.getByFacebookData, PM.models.Track));
                var html = getTemplate("searchresult-tracks")({tracks: tracks});
                that.$('ul.search-results').append(html).removeClass("loading");
                that.$el.addClass("tracks");
                that.$('ul.search-results.ui-listview').listview('refresh');
            });
        },
    });


    AddSongRecentView = BaseAddSongView.extend({
        template: getTemplate('add-song-recent-page'),
        className: 'add-song-recent-page add-song-page',

        events: {
            "click ul.search-results > li.track": "addSong"
        },

        close: function () {
            var that = this;
            ActivePartyUtil.deactivate();
            that.$('ul.search-results > li').removeClass("ui-btn-active");
            that.undelegateEvents();
        },

        render: function () {
            var that = this;

            clutils.checkConstraints(that.options.party_id, {_isUniqueId: true});
            that.party = activeParties.get(that.options.party_id);
            if (!that.party) {
                console.log("no party found with id " + that.options.party_id);
                $.mobile.changePage("#partyoverview");
                return;
            }
            ActivePartyUtil.activate(that.party.id);

            that.$el.html(that.template({party: that.party}));
            that.loadRecentTracks();
            return that;
        },

        loadRecentTracks: function () {
            var that = this;
            $('ul.search-results').addClass("loading");
            $('ul.search-results .track').remove();

            PM.domain.FacebookDomain.getRecentSpotifyPlays(function (trackdata) {
                var tracks = _.map(trackdata, _.bind(PM.models.Track.getByFacebookData, PM.models.Track));
                var html = getTemplate("searchresult-tracks")({tracks: tracks});
                that.$('ul.search-results').append(html).removeClass("loading");
                that.$('ul.search-results.ui-listview').listview('refresh');
            });
        },
    });

    AddSongSearchView = BaseAddSongView.extend({
        template: getTemplate('add-song-search-page'),
        className: 'add-song-search-page add-song-page',

        events: {
            "submit #searchform": function () {$('#searchfield').blur(); }, // will do the search per the next line
            "blur #searchfield": "search",
            "click ul#searchdomain > li": "updateSegmetedButtonAndSearch",
            "click ul.search-results > li": "addSong"
        },

        close: function () {
            var that = this;
            ActivePartyUtil.deactivate();
            that.$('ul.search-results > li').removeClass("ui-btn-active");
            that.undelegateEvents();
        },

        render: function () {
            var that = this;

            clutils.checkConstraints(that.options.party_id, {_isUniqueId: true});
            that.party = activeParties.get(that.options.party_id);
            if (!that.party) {
                console.log("no party found with id " + that.options.party_id);
                $.mobile.changePage("#partyoverview");
                return;
            }
            ActivePartyUtil.activate(that.party.id);

            that.$el.html(that.template({party: that.party}));
            return that;
        },

        updateSegmetedButtonAndSearch: function (event) {
            var that = this;
            $('ul#searchdomain > li.active').removeClass("active");
            $(event.currentTarget).addClass("active");
            that.search();
        },


        search: function () {
            var that = this;
            var searchterms = $('#searchfield').val();
            $('ul.search-results').addClass("loading");
            $('ul.search-results .track').remove();
            var searchdomain = $('ul#searchdomain > li.active').prop('id');
            switch (searchdomain) {
            case 'search-in-tracks':
                PM.domain.SpotifyDomain.search(searchterms, function (trackdata) {
                    var tracks = _.map(trackdata, _.bind(PM.models.Track.getBySpotifyData, PM.models.Track));
                    var newsearchterms = $('#searchfield').val();
                    if (newsearchterms === searchterms) {
                        var html = getTemplate("searchresult-tracks")({tracks: tracks});
                        that.$('ul.search-results').html(html).removeClass("loading");
                        that.$('ul.search-results.ui-listview').listview('refresh');
                    }
                });
                break;
            case 'search-in-albums':
                PM.domain.SpotifyDomain.searchAlbums(searchterms, function (albumsdata) {
                    var newsearchterms = $('#searchfield').val();
                    if (newsearchterms === searchterms) {
                        var html = getTemplate("searchresult-albums")({albums: albumsdata});
                        that.$('ul.search-results').html(html).removeClass("loading");
                        that.$('ul.search-results.ui-listview').listview('refresh');
                    }
                });
                break;
            default:
                throw "searchdomain unknown: " + searchdomain;
            }
        },
    });

    PartyView = Backbone.View.extend({
        template: getTemplate('party-page'),
        className: 'party-page',

        events: {
            "click #add-track": function () {toggleShowActionSheet($("#add-track-actionsheet")); },
            "click #add-track-actionsheet .cancel": function () {toggleShowActionSheet($("#add-track-actionsheet")); },
            "swipe ul.tracks > li.track-in-playlist": "showDelete",
            "click ul.tracks > li.track-in-playlist": "clickTrack",
            "click .delete-button": "deleteTrack",
            "click .play-button": "playTrack",
        },

        close: function () {
            var that = this;
            ActivePartyUtil.deactivate();
            that.party.get("playlist").off(null, null, that);
            that.party.off(null, null, that);
            that.undelegateEvents();
        },

        render: function () {
            var that = this;
            clutils.checkConstraints(that.options.party_id, {_isUniqueId: true});
            that.party = activeParties.get(that.options.party_id);
            if (!that.party) {
                console.log("no party found with id " + that.options.party_id);
                $.mobile.changePage("#partyoverview");
                return;
            }

            ActivePartyUtil.activate(that.party.id);
            that.$el.html(that.template({party: that.party}));
            that.party.get("playlist").on("add", that.addPlaylistItem, that);
            that.party.get("playlist").on("remove", that.removePlaylistItem, that);
            that.party.get("playlist").on("reset", that.onResetPlaylist, that);
            that.party.on("change", that.onPlayStatusChange, that); // not all changed will be play status changes, but most will, so we'll just catch all...
            that.onResetPlaylist();
            return that;
        },

        clickTrack: _.debounce(function (event) {
            var that = this;
            if ($(event.target).parents().addBack().hasClass("button")) {
                //click was on a button, we don't want it
                return;
            }
            var target = $(event.currentTarget);
            if (target.hasClass("show-play")) {
                target.removeClass("show-play");
                return;
            }
            //if something is open, this click event is a close
            that.hidePlaylistButtons();
            target.addClass("show-play");
            that.hidePlaylistButtonsAfterTimeout();
        }, 400, {immediate: true}),

        hidePlaylistButtons: function () {
            var that = this;
            var track_els = that.$("li.track-in-playlist");
            if (track_els.hasClass("show-delete") || track_els.hasClass("show-play")) {
                track_els.removeClass("show-delete show-play");
                return true;
            }
            return false;
        },

        playTrack: _.debounce(function (event) {
            var that = this;
            var target = $(event.currentTarget);
            that.hidePlaylistButtons();
            var track_in_playlist = $(target.parents("li.track-in-playlist")).prop("track-in-playlist");
            var action = PM.models.Action.createAction(PM.app.loggedin_user, that.party, "PlayTrack",
                                                       {tip_number: track_in_playlist.get("tip_number")});
            PM.domain.PartyNodeDomain.proposeAction(action.serialize());
        }, 400, {immediate: true}),

        deleteTrack: function (event) {
            var that = this;
            that.hidePlaylistButtons();
            var target = $(event.currentTarget);
            if (target.hasClass("deleted")) {
                return;
            }
            var track_in_playlist = $(target.parents("li.track-in-playlist")).prop("track-in-playlist");
            var action = PM.models.Action.createAction(PM.app.loggedin_user, that.party, "TrackRemove",
                                                       {tip_number: track_in_playlist.get("tip_number")});
            PM.domain.PartyNodeDomain.proposeAction(action.serialize());
        },

        showDelete: _.debounce(function (event) {
            var that = this;
            var target = $(event.currentTarget);
            that.hidePlaylistButtons();
            target.addClass("show-delete");
            that.hidePlaylistButtonsAfterTimeout();
        }, 400, {immediate: true}),

        hidePlaylistButtonsAfterTimeout: _.debounce(function () {
            var that = this;
            that.hidePlaylistButtons();
        }, 10000),

        onPlayStatusChange: function () {
            var that = this;
            var track_in_playlist = that.party.getCurrentTrackInPlaylist();
            var track_els = that.$("ul.tracks > li.track-in-playlist");
            _.each(track_els, function (element) {
                var $el = $(element);
                $el.toggleClass("now-playing", $el.prop("track-in-playlist") === track_in_playlist);
            });
            that.$("ul.tracks").toggleClass("paused", that.party.get("play_status") === "pause");
        },

        getTrackInPlaylistElement: function (track_in_playlist) {
            var that = this;
            var track = track_in_playlist.getTrack();
            var user = track_in_playlist.getUser();
            var template = getTemplate("playlist-item");
            var el = $(template({track: track,
                                 track_in_playlist: track_in_playlist,
                                 user: user,
                                 deletable: track_in_playlist.canBeDeletedBy(PM.app.loggedin_user.id, that.party),
                                 playable: that.party.mayGivePlayCommand(PM.app.loggedin_user),
            }));
            el.prop({"track-in-playlist": track_in_playlist});
            return el;
        },

        addPlaylistItem: function (track_in_playlist) {
            var that = this;
            var tracks_dom = that.$("ul.tracks");
            var track_el = that.getTrackInPlaylistElement(track_in_playlist);
            tracks_dom.append(track_el);
            that.$('ul.tracks.ui-listview').listview('refresh');
        },

        removePlaylistItem: function (track_in_playlist) {
            var that = this;
            var track_els = that.$("ul.tracks > li.track-in-playlist");
            $(_.find(track_els, function (el) {
                return $(el).prop("track-in-playlist") === track_in_playlist;
            })).addClass("deleted").children("h3")
                .html("Deleted by <strong>" + track_in_playlist.getUser().getName(that.party) + "</strong>");
        },

        onResetPlaylist: function () {
            var that = this;
            var tracks_in_playlist = that.party.get("playlist").toArray();
            var track_els = that.$("ul.tracks > li.track-in-playlist");
            var i;
            for (i = 0; i < tracks_in_playlist.length; i++) {
                while (track_els[i] && track_els[i].track_in_playlist !== tracks_in_playlist[i]) {
                    that.$(track_els).remove();
                    track_els.splice(i, 1);
                }
                if (!track_els[i]) {
                    break;
                }
            }
            for (; i < tracks_in_playlist.length; i++) {
                that.addPlaylistItem(tracks_in_playlist[i]);
            }
            that.onPlayStatusChange();
        },

        
    });

    PartyOverviewView = Backbone.View.extend({
        template: getTemplate('party-overview-page'),
        className: 'party-overview-page',

        close: function () {
            var that = this;
            activeParties.off(null, null, that);
            that.undelegateEvents();
        },

        events: {
        },

        render: function () {
            var that = this;
            that.$el.html(that.template());
            activeParties.on("add", that.addActiveParty, that);
            activeParties.on("remove", that.removeActiveParty, that);
            activeParties.on("reset", that.resetActiveParties, that);
            activeParties.on("change", that.activePartyChange, that);
            that.resetActiveParties();
            that.loadAndRenderAllParties();
            return that;
        },

        activePartyChange: function (party) {
            var that = this;
            var el = that.$('ul.parties li.party_' + party.id);
            var new_el = $(getTemplate("party-in-list")({party: party, active: !!activeParties.get(party.id)}));
            $("a", el).attr("href", $("a", new_el).attr("href"));
            $("h2", el).html($("h2", new_el).html());
            $("h3", el).html($("h3", new_el).html());
            $(".number-of-users > span", el).html($("span.number-of-users > span", new_el).html());
            $(".number-of-tracks > span", el).html($("span.number-of-tracks > span", new_el).html());
            that.$('ul.parties.ui-listview').listview('refresh');
        },

        resetActiveParties: function () {
            var that = this;
            activeParties.each(_.bind(that.addActiveParty, that));
        },

        removeActiveParty: function (party) {
            var that = this;
            var el = that.$('ul.parties li.party_' + party.id);
            el.removeClass("activeparty");
            var new_el = $(getTemplate("party-in-list")({party: party, active: !!activeParties.get(party.id)}));
            $("a", el).attr("href", $("a", new_el).attr("href"));
            if (that.$('li.party.activeparty'.length > 0)) {
                //else it's already at the right place
                that.$('li.party.activeparty:last').after(el); //move it below the last active party
            }
            that.$('ul.parties.ui-listview').listview('refresh');
        },

        addActiveParty: function (party) {
            var that = this;
            var el = that.$('ul.parties li.party_' + party.id);
            if (el) {
                var new_el = $(getTemplate("party-in-list")({party: party, active: !!activeParties.get(party.id)}));
                $("a", el).attr("href", $("a", new_el).attr("href"));
            } else {
                el = $(getTemplate("party-in-list")({party: party, active: true}));
                el.addClass("invisible");
                _.delay(function () {el.removeClass("invisible"); }, 0);
            }
            if (that.$('li.party.activeparty').length === 0) {
                el.parent().prepend(el); //move it to the top;
            } else {
                that.$('li.party.activeparty:last').after(el); //move it below the last active party
            }
            el.addClass("activeparty");
            that.$('ul.parties.ui-listview').listview('refresh');
        },

        loadAndRenderAllParties: function (callback) {
            var that = this;
            PM.domain.PartyNodeDomain.getMyParties(/*limit*/ 50, /*before_timestamp*/ null, function (parties_data) {
                var el = that.$('ul.parties');
                el.empty();
                activeParties.each(function (party) {
                    el.append(getTemplate("party-in-list")({party: party, active: true}));
                });
                _.each(parties_data, function (party_data) {
                    var party = PM.models.Party.unserialize(party_data);
                    if (!activeParties.get(party.id)) {
                        el.append(getTemplate("party-in-list")({party: party, active: false}));
                    }
                });
                that.$('ul.parties.ui-listview').listview('refresh');
                if (callback) {
                    callback();
                }
            });
        },
    });

    LoginView = Backbone.View.extend({
        template: getTemplate('login-page'),

        events: {
            "click .fb-login-button": "facebookLogin",
        },

        className: 'login-page',

        render: function () {
            var that = this;
            that.$el.html(that.template({party_id: that.options.party_id}));
            return that;
        },

        facebookLogin: function () {
            window.location = "https://m.facebook.com/dialog/oauth?redirect_uri=" + encodeURIComponent(window.location.toString()) + "&client_id=" + encodeURIComponent(PM.domain.FacebookDomain.FACEBOOK_APP_ID) + "&response_type=token&scope=user_actions.music";
        },
    });

    window.onerror = function () {
        _.delay(function () {
            var popup = $(getTemplate("error-message")()).popup().popup("open");
            popup.one("popupafteropen", function () {
                $('.ui-popup-screen.in').on("click", function (event) {event.stopImmediatePropagation(); }); // removes overlay click-to-close
                $('.ui-popup-screen.in').on("touchstart", function (event) {event.stopImmediatePropagation(); }); // removes overlay click-to-close
            });
            popup.trigger("create");
        });
    };

    var router = new $.mobile.Router({
        "^#login(?:\\?(.*))?$": {
            events: "bs",
            handler: function (type, match, ui, page) {
                console.log("login");
                var params = (match[1] && match[1].length) ? router.getParams(match[1]) : {};
                PM.domain.FacebookDomain.isLoggedin(function (loggedin) {
                    if (loggedin) {
                        if (params.party_id) {
                            $.mobile.changePage("#party/" + params.party_id);
                        } else {
                            $.mobile.changePage("#partyoverview");
                        }
                    } else {
                        createAndRenderView(LoginView, page, {party_id: params.party_id});
                    }
                });
            },
        },
        "^#partyoverview": {
            events: "bs",
            handler: function (type, match, ui, page) {
                createAndRenderViewLoggedin(PartyOverviewView, page);
            },
        },
        "^#activeparty_([A-Za-z0-9_\\-]{10})$": {
            events: "bs",
            handler: function (type, match, ui, page) {
                var party_id = match[1];
                createAndRenderViewLoggedin(PartyView, page, {party_id: party_id});
            },
        },
        "^#activeparty_([A-Za-z0-9_\\-]{10})_addsong_search$": {
            events: "bs",
            handler: function (type, match, ui, page) {
                var party_id = match[1];
                createAndRenderViewLoggedin(AddSongSearchView, page, {party_id: party_id});
            },
        },
        "^#activeparty_([A-Za-z0-9_\\-]{10})_addsong_recent$": {
            events: "bs",
            handler: function (type, match, ui, page) {
                var party_id = match[1];
                createAndRenderViewLoggedin(AddSongRecentView, page, {party_id: party_id});
            },
        },
        "^#activeparty_([A-Za-z0-9_\\-]{10})_addsong_playlist$": {
            events: "bs",
            handler: function (type, match, ui, page) {
                var party_id = match[1];
                createAndRenderViewLoggedin(AddSongPlaylistView, page, {party_id: party_id});
            },
        },
        "^#oldparty_([A-Za-z0-9_\\-]{10})$": {
            events: "bs",
            handler: function (type, match, ui, page) {
                var party_id = match[1];
                createAndRenderViewLoggedin(OldPartyView, page, {party_id: party_id});
            },
        },
        ".": {
            events: "h",
            handler: function (type, match, ui, page) {
                var view = $(page).prop("view");
                if (view && view.close) {
                    view.close();
                    $(page).prop({view: null});
                }
            },
        },
        "^#([^?]*)": {
            events: "bC",
            handler: function (undefined, match) {
                var page_id = match[1];
                if (!document.getElementById(page_id)) {
                    var page = $("<div>");
                    page.attr({
                        id: page_id,
                        "data-role": "page",
                    });
                    page.text(page_id);
                    $('body').append(page);
                }
            }
        },
    });

    PM.domain.FacebookDomain = PM.domain.FacebookWebDomain;
    PM.domain.FacebookDomain.init();
    PM.domain.SpotifyDomain = PM.domain.SpotifyWebDomain;

})(window.PM);
