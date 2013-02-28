/*jshint browser: true*/
/*global clutils, _, $, Backbone, Toolbox */

window.PM = window.PM || {};
window.PM.app = window.PM.app || {};

(function (PM) {
    "use strict";
    var LoginView, PartyOverviewView, OldPartyView, PartyView, AddSongView;

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

    AddSongView = Backbone.View.extend({
        template: getTemplate('add-song-page'),
        className: 'add-song-page',

        events: {
            "submit #searchform": function () {$('#searchfield').blur(); }, // will do the search per the next line
            "blur #searchfield": "search",
            "click ul#searchdomain > li > a": "search",
            "click ul.search-results > li": "addSong"
        },

        close: function () {
            var that = this;
            ActivePartyUtil.deactivate();
            that.$('ul.search-results > li').removeClass("ui-btn-active");
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

        search: function () {
            var that = this;
            var searchterms = $('#searchfield').val();
            $('ul.search-results').empty().addClass("loading");
            var searchdomain = $('ul#searchdomain > li > a.ui-btn-active').prop('id');
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

    PartyView = Backbone.View.extend({
        template: getTemplate('party-page'),
        className: 'party-page',

        events: {
            "click ul.tracks > li.track-in-playlist": "showControls",
            "click .delete-button": "toggleDeleteTrack",
            "click .play-button": "playTrack",
            "click .pause-button": "togglePausePlay",
        },

        close: function () {
            var that = this;
            ActivePartyUtil.deactivate();
            that.party.off("playcommand", that.onPlayCommand, that);
            that.party.get("playlist").off(null, null, that);
            that.party.off(null, null, that);
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
            that.party.get("playlist").on("change:deleted_by_user_id", that.onChangePlaylistItem, that);
            that.party.get("playlist").on("reset", that.onResetPlaylist, that);
            that.party.on("change", that.onPlayStatusChange, that); // not all changed will be play status changes, but most will, so we'll just catch all...
            that.onResetPlaylist();
            return that;
        },

        togglePausePlay: _.debounce(function () {
            var that = this;
            var type = that.party.get("play_status") === "play" ? "Pause" : "Play";
            var action = PM.models.Action.createAction(PM.app.loggedin_user, that.party, type, {});
            PM.domain.PartyNodeDomain.proposeAction(action.serialize());
        }, 400, {immediate: true}),

        playTrack: _.debounce(function (event) {
            var that = this;
            var $target = $(event.currentTarget);
            var track_in_playlist = $($target.parents("li.track-in-playlist")).prop("track-in-playlist");
            var index = that.party.get("playlist").indexOf(track_in_playlist);
            var action = PM.models.Action.createAction(PM.app.loggedin_user, that.party, "PlayTrack", {position: index});
            PM.domain.PartyNodeDomain.proposeAction(action.serialize());
        }, 400, {immediate: true}),

        toggleDeleteTrack: _.debounce(function (event) {
            var that = this;
            var $target = $(event.currentTarget);
            var track_in_playlist = $($target.parents("li.track-in-playlist")).prop("track-in-playlist");
            var index = that.party.get("playlist").indexOf(track_in_playlist);
            var type = track_in_playlist.isDeleted() ? "TrackUnRemove" : "TrackRemove";
            var action = PM.models.Action.createAction(PM.app.loggedin_user, that.party, type, {position: index});
            PM.domain.PartyNodeDomain.proposeAction(action.serialize());
        }, 400, {immediate: true}),

        showControls: _.debounce(function (event) {
            var that = this;
            var target = event && event.currentTarget;

            var track_els = that.$("ul.tracks > li.track-in-playlist");
            _.each(track_els, function (element) {
                var $el = $(element);
                if (element === target) {
                    $el.toggleClass("show-controls");
                } else {
                    $el.removeClass("show-controls");
                }
            });
            that.hideControlsAfterTimeout();
        }, 200, {immediate: true}),

        hideControlsAfterTimeout: _.debounce(function () {
            var that = this;
            that.showControls();
        }, 10000),

        onPlayStatusChange: function () {
            var that = this;
            var current_index = that.party.get("current_playlist_index");
            var track_els = that.$("ul.tracks > li.track-in-playlist");
            _.each(track_els, function (element, index) {
                var $el = $(element);
                $el.toggleClass("now-playing", index === current_index);
            });
            that.$("ul.tracks").toggleClass("paused", that.party.get("play_status") === "pause");
        },

        getTrackInPlaylistElement: function (track_in_playlist) {
            var track = track_in_playlist.getTrack();
            var user = track_in_playlist.getUser();
            var deleted_by_user = track_in_playlist.getDeletedByUser();
            var el = $(getTemplate("playlist-item")({track: track, track_in_playlist: track_in_playlist, user: user, deleted_by_user: deleted_by_user}));
            el.prop({"track-in-playlist": track_in_playlist});
            return el;
        },

        updateTrackInPlaylistElement: function (element) {
            var $element = $(element);
            var track_in_playlist = $element.prop("track-in-playlist");
            $element.toggleClass("deleted", track_in_playlist.isDeleted());
            $(".deleted-by", $element).html(track_in_playlist.isDeleted() ? track_in_playlist.getDeletedByUser().getHtmlLazyLoad("name") : "");
        },

        addPlaylistItem: function (track_in_playlist) {
            var that = this;
            var tracks_dom = that.$("ul.tracks");
            var track_el = that.getTrackInPlaylistElement(track_in_playlist);
            that.updateTrackInPlaylistElement(track_el);
            tracks_dom.append(track_el);
            that.$('ul.tracks.ui-listview').listview('refresh');
        },

        onChangePlaylistItem: function (track_in_playlist) {
            var that = this;
            var track_els = that.$("ul.tracks > li.track-in-playlist");
            _.each(track_els, function (el) {
                if ($(el).prop("track-in-playlist") === track_in_playlist) {
                    that.updateTrackInPlaylistElement(el);
                }
            });
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
                that.updateTrackInPlaylistElement(that.$(track_els[i]));
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
            window.location = "https://m.facebook.com/dialog/oauth?redirect_uri=" + encodeURIComponent(window.location.toString()) + "&client_id=" + encodeURIComponent(PM.domain.FacebookDomain.FACEBOOK_APP_ID) + "&response_type=token";
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
        "^#activeparty_([A-Za-z0-9_\\-]{10})_addsong$": {
            events: "bs",
            handler: function (type, match, ui, page) {
                var party_id = match[1];
                createAndRenderViewLoggedin(AddSongView, page, {party_id: party_id});
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
