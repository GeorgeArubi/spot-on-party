from google.appengine.ext import db
from google.appengine.ext.db import polymodel

_get_party_owner_user_saved = False
def get_party_owner_user():
    user = User(key_name="party_owner", name="Party owner")
    global _get_party_owner_user_saved # pylint: disable=W0603
    if not _get_party_owner_user_saved: #threadsave: worst case it gets saved multiple times per instance
        user.put()
        _get_party_owner_user_saved = True
    return user

class User(db.Model):
    "NB: the indentifier is the external id"
    name = db.StringProperty()

    def id(self):
        return self.key().id_or_name()

    @classmethod
    def create_or_update_by_fb_users(cls, fb_users):
        users = [cls(key_name=fb_user["id"], name=fb_user["name"]) for fb_user in fb_users]
        db.put(users)
        return users

class Song(db.Model):
    "NB: the indentifier is the external id"
    name = db.StringProperty()

    def id(self):
        return self.key().id_or_name()


class SecurityException(Exception):
    pass

class Party(db.Model):
    name = db.StringProperty()
    owner = db.ReferenceProperty(reference_class=User)
    active = db.BooleanProperty()
    invited_user_ids = db.ListProperty(db.Key)
    created = db.DateTimeProperty(auto_now_add=True)

    if False:
        party_actions = db.Query()

    @classmethod
    def create(cls, name, owner, invited_users):
        party = cls()
        party.name = name
        party.owner = owner
        party.active = True
        party.invited_user_ids = [user.key() for user in invited_users]
        party.put()
        
        PartyCreateAction(party=party, user=get_party_owner_user(), name=name).put()

        db.put([PartyInviteAction(party=party, user=get_party_owner_user(), invited_user=user) for user in invited_users])
        songs = [
            Song(key_name="spotify:track:7gSeGMqiOrv7ftmxYLFaOA", name="Moondance"),
            Song(key_name="spotify:track:3HReViQnCFUk56f4PXO3Tx", name="A night like this"),
            Song(key_name="spotify:track:04zm16Wb5rUuQzhpC8JsZh", name="That Man")]
            
        db.put(songs)

        db.put([PartySongAddAction(song=song, party=party, user=invited_users[0]) for song in songs])
        return party

    def _loggedin_user_is_invited(self, loggedin_user):
        if not loggedin_user.key() in self.invited_user_ids:
            raise SecurityException("Loggedin user %s may not invite (%s)" % (loggedin_user.key(), ", ".join(self.invited_user_ids)))
        

    def remove_song(self, position, user, loggedin_user):
        self._loggedin_user_is_invited(loggedin_user)
        action = PartySongRemoveAction(party=self, user=user, position=position)
        action.put()
        #TODO: fanout via channel
        return action

    def play_position(self, position, user, loggedin_user):
        self._loggedin_user_is_invited(loggedin_user)
        action = PartyPositionPlayAction(party=self, user=user, position=position)
        action.put()
        #TODO: fanout via channel
        return action

    def for_api_use(self):
        return {
            "type": self.__class__.__name__,
            "id": self.key().id(),
            "owner_id": self.owner.id(),
            "actions": [party_action.for_api_use() for party_action in self.party_actions.order("__key__")]}
                

class PartyAction(polymodel.PolyModel):
    party = db.ReferenceProperty(reference_class=Party, collection_name="party_actions")
    created = db.DateTimeProperty(auto_now_add=True)
    user = db.ReferenceProperty(reference_class=User)

    def for_api_use(self):
        return {
            "type": self.__class__.__name__,
            "id": self.key().id(),
            "user_id": self.user.id(),
            "created": self.created}

class PartyChangeNameAction(PartyAction):
    name = db.StringProperty()
    
    def for_api_use(self):
        return dict(super(PartyChangeNameAction, self).for_api_use().items() + [('name', self.name),])

    
class PartyCreateAction(PartyChangeNameAction):
    pass

class PartyInviteAction(PartyAction):
    invited_user = db.ReferenceProperty(reference_class=User)

    def for_api_use(self):
        return dict(super(PartyInviteAction, self).for_api_use().items() + [('invited_user_id', self.invited_user.id()),])

class PartyKickAction(PartyAction):
    kicked_user = db.ReferenceProperty(reference_class=User)

    def for_api_use(self):
        return dict(super(PartyKickAction, self).for_api_use().items() + [('kicked_user_id', self.kicked_user.id()),])

class PartyJoinedAction(PartyAction):
    pass

class PartyLeftAction(PartyAction):
    pass

class PartySongAddAction(PartyAction):
    song = db.ReferenceProperty(reference_class=Song)

    def for_api_use(self):
        return dict(super(PartySongAddAction, self).for_api_use().items() + [('song_id', self.song.id()),])

class PartySongRemoveAction(PartyAction):
    position = db.IntegerProperty()

    def for_api_use(self):
        return dict(super(PartySongRemoveAction, self).for_api_use().items() + [("position", self.position)])

class PartyPositionPlayAction(PartyAction):
    position = db.IntegerProperty()

    def for_api_use(self):
        return dict(super(PartyPositionPlayAction, self).for_api_use().items() +
                    [("position", self.position)])

class PartyPlayAction(PartyAction):
    pass

class PartyPauseAction(PartyAction):
    pass

class PartyOnAction(PartyAction):
    pass #TODO: update the party "active" state
class PartyOffACtion(PartyAction):
    pass #TODO: update the party "active" state

