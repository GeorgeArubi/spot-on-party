import webapp2
import model
import util

import urllib, urllib2, logging, json, threading

def to_qs(params):
    "transfers parameters to querystring format; takes special care of values that are arrays, will become csv"
    newparams = {}
    for k, v in params.items():
        if isinstance(v, (list, tuple)):
            newparams[k] = ",".join(v)
        else:
            newparams[k] = v
    return urllib.urlencode(newparams)

class RequestHandlerBase(webapp2.RequestHandler):
        
    def get_access_token_from_request(self):
        return self.request.get("at")

    def facebook_graph_api_call(self, path, parameters, public_only_info=False):
        local_parameters = {}
        if not public_only_info:
            if self.get_access_token_from_request():
                local_parameters["access_token"] = self.get_access_token_from_request()
        local_parameters.update(parameters)

        url = "https://graph.facebook.com/%s?%s" % (path, to_qs(local_parameters))
        logging.info("making call to url %s", url)
        try:
            jsonresult = urllib2.urlopen(url).read()
            logging.debug("result from call to %s: %s", url, jsonresult)
            return json.loads(jsonresult)
        except urllib2.URLError, e:
            logging.error("Request failed: %s", e)
        except Exception, e:
            logging.error("Error in JSON: %s\n%s", e, jsonresult)


    def get_users(self, ids):
        "gets user objects, creating them for so far unknown users"
        fb_users = self.facebook_graph_api_call("", {"ids": ids, "fields": ("id","name")}, public_only_info=True).values()
        users = model.User.create_or_update_by_fb_users(fb_users)
        #TODO: deleted facebook users should be retrieved from the database.... Sometime in the future
        return users

    _access_token_to_user_cache = {}
    _access_token_to_user_cache_lock = threading.Lock()
    def loggedin_user(self):
        cls = self.__class__
        access_token = self.get_access_token_from_request()
        with cls._access_token_to_user_cache_lock: # pylint: disable=W0212
            try:
                return cls._access_token_to_user_cache[access_token] # pylint: disable=W0212
            except KeyError:
                pass #simply don't return
        fb_user = self.facebook_graph_api_call("me", {"fields": ("id", "name")})
        user = model.User.create_or_update_by_fb_users([fb_user])[0]
        with cls._access_token_to_user_cache_lock: # pylint: disable=W0212
            cls._access_token_to_user_cache[access_token] = user # pylint: disable=W0212
        return user

    def reply_jsonp(self, data):
        self.response.headers['Content-Type'] = 'application/json'
        callback_name = self.request.get("callback")
        self.response.out.write("window[%s](%s);" % (
                json.dumps(callback_name),
                json.dumps(data, default=util.json_default_handler)))
        

class CreateParty(RequestHandlerBase):
    def get(self):
        name = self.request.get("name")
        invited_user_ids = self.request.get("invited_user_ids").split(",")
        if not self.loggedin_user().id() in invited_user_ids:
            invited_user_ids.append(self.loggedin_user().id())
        invited_users = self.get_users(invited_user_ids)

        party = model.Party.create(name, self.loggedin_user(), invited_users)

        self.reply_jsonp(party.for_api_use())

class RemoveSong(RequestHandlerBase):
    def get(self):
        party = model.Party.get_by_id(long(self.request.get("party_id")))
        if self.request.get("sp"):
            user = model.get_party_owner_user()
        else:
            user = self.loggedin_user()
        position = long(self.request.get("position"))
        action = party.remove_song(position, user, self.loggedin_user()) #pylint: disable=E1103
        self.reply_jsonp(action.for_api_use())

class PlayPosition(RequestHandlerBase):
    def get(self):
        party = model.Party.get_by_id(long(self.request.get("party_id")))
        if self.request.get("sp"):
            user = model.get_party_owner_user()
        else:
            user = self.loggedin_user()
        position = long(self.request.get("position"))
        action = party.play_position(position, user, self.loggedin_user()) #pylint: disable=E1103
        self.reply_jsonp(action.for_api_use())

class GetActiveParties(RequestHandlerBase):
    def get(self):
        loggedin_user = self.loggedin_user()
        parties = model.Party.all().filter("active", True).filter("invited_user_ids", loggedin_user.key())
        self.reply_jsonp([party.for_api_use() for party in parties])

logging.getLogger().setLevel(logging.DEBUG)
app = webapp2.WSGIApplication([
        ('/api/1/createparty', CreateParty),
        ('/api/1/removesong', RemoveSong),
        ('/api/1/playposition', PlayPosition),
        ('/api/1/getactiveparties', GetActiveParties)
                               ], debug=True)



