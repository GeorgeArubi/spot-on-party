/*jshint browser: true*/
/*global clutils, _, $, Backbone */

window.PM = window.PM || {};
window.PM.app = window.PM.app || {};

(function (PM) {
    "use strict";
    var LoginView, PartyOverviewView, OldPartyView;

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
            createAndRenderView.apply(this, arguments);
        } else {
            PM.domain.FacebookDomain.isLoggedin(function (loggedin) {
                if (loggedin) {
                    PM.domain.FacebookDomain.getLoggedinUserId(function (user_id) {
                        PM.app.loggedin_user = PM.models.User.getById(user_id); // will lazy-load, which is fine I think
                        PM.domain.FacebookDomain.getAccessToken(function (accessToken) {
                            PM.domain.PartyNodeDomain.connect(accessToken, false);
                            PM.domain.FacebookDomain.on("new token", function (token) {
                                PM.domain.PartyNodeDomain.updateToken(token);
                            });
                            createAndRenderView.apply(this, createAndRenderViewArguments);
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

    PartyOverviewView = Backbone.View.extend({
        template: getTemplate('party-overview-page'),
        className: 'party-overview-page',

        close: function () {
            var that = this;
            console.log("close");
            activeParties.off("add", that.addActiveParty, that);
            activeParties.off("remove", that.removeActiveParty, that);
            activeParties.off("reset", that.resetActiveParties, that);
        },

        render: function () {
            var that = this;
            that.$el.html(that.template());
            activeParties.on("add", that.addActiveParty, that);
            activeParties.on("remove", that.removeActiveParty, that);
            activeParties.on("reset", that.resetActiveParties, that);
            that.resetActiveParties();
            that.loadAndRenderAllParties();
            return that;
        },

        resetActiveParties: function () {
            var that = this;
            that.$('ul.parties li.active-party.party').remove();
            activeParties.each(_.bind(that.addActiveParty, that));
            that.$('ul.parties').toggleClass("has-active-parties", activeParties.length > 0);
        },

        removeActiveParty: function (party) {
            var that = this;
            that.$('ul.parties li.active-party.party_' + party.id).addClass("invisible");
            that.$('ul.parties').toggleClass("has-active-parties", activeParties.length > 0);
        },

        addActiveParty: function (party) {
            var that = this;
            var li = $(getTemplate("active-party-in-list")({party: party}));
            li.addClass("invisible party_" + party.id);
            _.delay(function () {li.removeClass("invisible"); }, 0);
            that.$('#all-parties-divider').before(li);
            that.$('ul.parties').toggleClass("has-active-parties", activeParties.length > 0);
            that.$('ul.parties.ui-listview').listview('refresh');
        },

        loadAndRenderAllParties: function (callback) {
            var that = this;
            PM.domain.PartyNodeDomain.getMyParties(/*limit*/ 50, /*before_timestamp*/ null, function (parties_data, parties_left) {
                var parties = _.map(parties_data, function (party_data) {return PM.models.Party.unserialize(party_data); });
                var template = getTemplate("all-parties-list");
                var html = template({parties: parties, parties_left: parties_left});
                that.$('#all-parties-divider').after(html);
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

    var router = new $.mobile.Router({
        "^#login(?:\\?(.*))?$": {
            events: "bs",
            handler: function (type, match, ui, page) {
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
        "^#oldparty_([A-Za-z0-9_\\-]*)": {
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
