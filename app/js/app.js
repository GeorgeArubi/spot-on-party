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

    var createAndRenderView = function (Viewclass, element, options) {
        var myoptions = _.extend(options || {}, {el: element});
        var view = new Viewclass(myoptions);
        view.render();
        var el = $(element);
        el.addClass(view.className);
        el.attr("view", view);
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
            that.party = PM.collections.Parties.getInstance().get(that.options.party_id);
            if (that.party) {
                doRender();
            } else {
                PM.domain.PartyNodeDomain.getMyParty(that.options.party_id, function (party_data) {
                    if (!party_data) {
                        throw "Party with id " + that.options.party_id + " could not be found";
                    }
                    var party = PM.models.Party.unserialize(party_data);
                    that.party = party;
                    PM.collections.Parties.getInstance().add(party);
                    doRender();
                });
            }
            return that;
        },


    });

    PartyOverviewView = Backbone.View.extend({
        template: getTemplate('party-overview-page'),
        className: 'party-overview-page',

        render: function () {
            var that = this;
            that.$el.html(that.template());
            that.loadAndRenderActiveParties(_.bind(that.loadAndRenderAllParties, that));
            return that;
        },

        loadAndRenderActiveParties: function (callback) {
            var that = this;
            PM.domain.PartyNodeDomain.getMyActiveParties(/*limit*/ 50, /*before_timestamp*/ null, function (parties_data, parties_left) {
                var parties = _.map(parties_data, _.bind(PM.models.Party.unserialize, PM.models.Party));
                PM.collections.Parties.getInstance().add(parties);
                var template = getTemplate("active-parties-list");
                var html = template({parties: parties, parties_left: parties_left});
                that.$('.active-parties').html(html).trigger("create");
                if (callback) {
                    callback();
                }
            });
        },

        loadAndRenderAllParties: function (callback) {
            var that = this;
            PM.domain.PartyNodeDomain.getMyParties(/*limit*/ 50, /*before_timestamp*/ null, function (parties_data, parties_left) {
                var parties = _.map(parties_data, _.bind(PM.models.Party.unserialize, PM.models.Party));
                var template = getTemplate("all-parties-list");
                var html = template({parties: parties, parties_left: parties_left});
                that.$('.all-parties').html(html).trigger("create");
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
                var view = $(page).attr("view");
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
