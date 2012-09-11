/*jslint browser:true, vars: true, nomen: true */
"use strict";

if (!window.PM) {
    window.PM = {};
}


(function (PM, Backbone, $, _) {
    var FacebookLoginView, StartNewPartyView;

    var getTemplate = function (id) {
        var el = $('#' + id);
        if (el.length === 0) {
            throw "Template '" + id + "' not found";
        }
        return _.template(el.html());
    };

    var current_view = null;
    var changeView = function (new_view) {
        if (current_view) {
            if (current_view.close) {
                current_view.close();
            }
            current_view.undelegateEvents();
        }
        current_view = new_view;
        $('#main-content').html(current_view.render().$el);
    };

    var checkFacebookLogin = function (loggedincode) {
        if (PM.app.current_user) {
            loggedincode();
        } else {
            PM.domain.FacebookSpotifyDomain.isLoggedin(function (loggedin) {
                if (loggedin) {
                    PM.app.loggedin_user_id = PM.domain.FacebookDomain.getLoggedinUserId();
                    //it would be nicer to actually use lazy loading for this user as well, but we need it directly synchronously
                    var user = new PM.models.User({
                        name: PM.domain.FacebookDomain.getLoggedinUserName(),
                        _status: PM.models.BaseModelLazyLoad.LOADED,
                        id: PM.app.loggedin_user_id,
                    });
                    PM.models.User.setToCache(user);
                    PM.app.current_user = PM.models.User.getMaster();
                    checkFacebookLogin(loggedincode);
                } else {
                    PM.app.navigate("", {trigger: true});
                }
            });
        }
    };

    FacebookLoginView = Backbone.View.extend({
        className: "welcome-page",

        events: {
            "click .facebook-login button": "login",
        },

        template: getTemplate("welcome-page"),

        render: function () {
            var that = this;
            that.$el.html(that.template());
            return that;
        },

        login: function () {
            PM.domain.FacebookDomain.showLoginPopup(function () {
                PM.app.navigate("");
                PM.app.facebookLogin(); // will advance to the new party page if logged in
            });
        },
    });

    StartNewPartyView = Backbone.View.extend({
        className: "new-party-page",

        events: {
            "click #logout": "logout",
            "submit #new-party-form": "createNewParty",
        },

        template: getTemplate("new-party-page"),

        render: function () {
            var that = this;
            that.$el.html(that.template({default_party_name: PM.models.Party.getDefaultPartyName()}));
            return that;
        },

        logout: function () {
            PM.domain.FacebookDomain.logout();
            PM.app.navigate("", {trigger: true});
        },

        createNewParty: function () {
            var party_name = $('#new-party-form #new-party-name').val().trim();
            if (party_name === "") {
                party_name = PM.models.Party.getDefaultPartyName();
            }
            PM.current_party = new PM.models.Party({
                id: 1, //TODO: we obviously need a party id that comes from the server.. Or random...
                owner: PM.app.current_user,
            });
            PM.current_party.createAndApplyOwnAction(
                "ChangeName",
                {name: party_name},
                function () {
                    PM.current_party.createAndApplyOwnAction(
                        "Invite",
                        {invited_user_id: PM.current_user.getActualUser().id},
                        function () {
                            PM.app.navigate("party/" + PM.current_party.id, {trigger: true});
                        }
                    );
                }
            );
        },
    });

    var AppRouter = Backbone.Router.extend({
        routes: {
            "": "facebookLogin",
            "history": "partyHistory",
            "party/new": "startParty",
            "party/:id": "showParty",
        },

        facebookLogin: function () {
            PM.domain.FacebookDomain.isLoggedin(function (loggedin) {
                if (loggedin) {
                    PM.app.navigate("party/new", {trigger: true});
                } else {
                    changeView(new FacebookLoginView());
                }
            });
        },

        startParty: function () {
            checkFacebookLogin(function () {
                var view = new StartNewPartyView();
                changeView(view);
                view.$("#new-party-name").focus();
            });

        },

        partyHistory: function () {
            console.log("partyHistory");
        },

        showParty: function (id) {
            console.log("ttt" + id);
        },
    });

    PM.app = new AppRouter();

    $(function () {
        PM.domain.FacebookDomain = PM.domain.FacebookSpotifyDomain;
        PM.domain.FacebookDomain.init();
        Backbone.history.start();
    });
}(window.PM, window.Backbone, window.$, window._));