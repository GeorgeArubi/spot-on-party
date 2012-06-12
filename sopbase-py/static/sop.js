/*jslint browser: true, devel: true, vars: true, newcap: true */
/*global Sop:true, FacebookClient, SpotifyClient, $, SOPBase, Util, Party, PartyUI */

/**
 * Main class for client app
 **/
"use strict";


var Sop = function () {
    var init;

    var onlogin;
    var onlogout;
    var engageParty;
    var registerUIHandlers;

    var facebook;
    var sopbase;
    var party;
    var party_ui;
    var spotify;

    engageParty = function (party_object) {
        $("#loggedin_pane").addClass("engage_party");
        party = Party(party_object.id, party_object.owner_id);
        $.each(party_object.actions, function (index, action) {
            party.feed(action);
        });
        party_ui = PartyUI(party, facebook, sopbase, spotify);
        party_ui.update();
    };

    registerUIHandlers = function () {
        $("a.fblogin").click(function (event) {
            facebook.login();
            event.preventDefault();
        });
        $("a.fblogout").click(function (event) {
            facebook.logout();
            event.preventDefault();
        });
        $("#playlist").click(function (event) {
            if ($(this).hasClass("inactive")) {
                $(this).removeClass("inactive");
            }
        });
    };

    onlogin = function () {
        $("body").addClass("loggedin");
        $("body").addClass("chooseparty");
        sopbase = SOPBase(facebook.getAccessToken());
        sopbase.getActiveParties(function (parties) {
            $("#choose_party_pane").removeClass("loading");
            if (parties.length === 0) {
                $("#choose_party_pane .content").addClass("no_parties");
            } else {
                $("#choose_party_pane .content").removeClass("no_parties");

                $("#choose_party_pane").removeClass("loading");
                var list = $("<ul/>");
                $.each(parties, function (index, party) {
                    var link = Util.addDefaultLink($("<a/>")).text(party.name);
                    link.click(function () {
                        engageParty(party);
                    });
                    list.append($("<li/>").append(link));
                });
                $(".partylist").append(list);
            }
        });
    };

    onlogout = function () {
        $("body").removeClass("loggedin");
    };

    init = function () {
        facebook = FacebookClient(onlogin, onlogout);
        spotify = SpotifyClient();
        registerUIHandlers();
    };

    init();

    return {};

};