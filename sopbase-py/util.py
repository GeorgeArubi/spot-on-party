from  google.appengine.api import memcache
from google.appengine.ext import db

class GlobalCounter:
    "Global counter. Provides a way to get incremental ids (guaranteed thread-safe and in steps of 1 at a time)"
    def __init__(self, name, gql_query_data):
        """Thread and instance safe global counter'. The gql_query should, when executed, result in 0 records (meaning the counter can start at 1), or exactly 1 number
        Note: because the query may theoretically retrieve 'old' data, whenever memcache looses the counter, duplicate numbers may be returned (this is unlikely however since memcache would only loose the counter when it wasn't used for a while in which case the query result should be accurate..."""
        self.name = name
        self.memcache_key = "GlobalCounter_%s" % name
        self.memcache_client = memcache.Client()
        self.gql_query_data = gql_query_data
    
    def current(self):
        "returns the current value of the counter"
        result = self.memcache_client.get(self.memcache_key)
        if result == None:
            self._init_memcache()
            return self.current()
        return result

    def next(self):
        "increments the counter by one and returns that value"
        result = self.memcache_client.incr(self.memcache_key)
        if result == None:
            self._init_memcache()
            return self.next()
        return result

    def _init_memcache(self):
        "inits the counter from the query"
        current = None
        try:
            gql_query = db.GqlQuery(*self.gql_query_data)
            result = gql_query.get()
            if result:
                current = getattr(result, gql_query.projection()[0])
        except db.KindError:
            #no records yet of this type.... So None
            pass
        if current == None:
            current = 0
        self.memcache_client.add(self.memcache_key, current)


def json_default_handler(obj):
    if hasattr(obj, 'isoformat'):
        return obj.isoformat()
    else:
        raise TypeError, 'Object of type %s with value of %s is not JSON serializable' % (type(obj), repr(obj))
