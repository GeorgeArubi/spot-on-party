/*jslint browser: true, sloppy: true */
/*globals Ext, SOP, FB*/

/**
 * This view shows the 'Initializing' loading mask, as well as displaying the Login text and button
 * if the user isn't logged in to Facebook.
 */
Ext.define('SOP.view.FacebookLogin', {
    extend: 'Ext.Container',
    requires: ["SOP.domain.FacebookDomain"],

    config: {
    },

    constructor: function () {
        this.callParent(arguments);
        this.setHtml([
            '<h2>Spot On Party</h2>',
            '<p>Spot On Party allows you to colaboratively control a party playlist</p>',
            '<a class="fbLogin" href="https://m.facebook.com/dialog/oauth?',
            Ext.Object.toQueryString({
                redirect_uri: window.location.protocol + "//" + window.location.host + window.location.pathname,
                client_id: SOP.domain.FacebookDomain.FACEBOOK_APP_ID,
                response_type: 'token'
            }),
            '"></a>',
            '<div class="fb-facepile" data-app-id="' + SOP.domain.FacebookDomain.FACEBOOK_APP_ID + '" data-max-rows="2" data-width="300"></div>'
        ].join(''));
    },

});
